import { isPromise, mergeProps } from "./helpers";
import ReactDOM from "./ReactDOM";
import type {
  Component,
  ContextProviderMetadata,
  HookUpdate,
  Lane,
  PassiveEffectRecord,
  Props,
  ReactElementTag,
  SuspenseCacheRecord,
  SuspenseResource,
  SyncTag,
} from "./types";

type HookNode = {
  id: string;
  hooks: unknown[];
  hookIndex: number;
  children: Map<string, HookNode>;
  parent?: HookNode;
  updateQueue: HookUpdate[];
};

type SuspenseCache = Map<string, SuspenseCacheRecord<unknown>>;
type EffectHookState = {
  __type: "effect";
  dependencies: unknown[];
  cleanup?: () => void;
};

const lanePriority: Record<Lane, number> = {
  sync: 0,
  default: 1,
  transition: 2,
};

export function React() {
  const rootNode: HookNode = createNode("root");
  const activeNodes = new Set<string>();
  let currentNode: HookNode = rootNode;
  enterComponent(rootNode.id);
  activeNodes.add(rootNode.id);
  const FragmentSymbol = Symbol.for("react.fragment");
  const ContextSymbol = Symbol.for("react.context");
  const SuspenseSymbol = Symbol.for("react.suspense");
  const ErrorBoundarySymbol = Symbol.for("react.error_boundary");
  const suspenseCaches = new Map<string, SuspenseCache>();
  const contextValueStacks = new Map<symbol, unknown[]>();
  const pendingPassiveEffects: PassiveEffectRecord[] = [];
  const pendingTransitionCallbacks: Array<() => void> = [];
  let scheduledLane: Lane | null = null;
  let renderScheduled = false;
  let passiveEffectsScheduled = false;
  let batchDepth = 0;
  let currentUpdateLane: Lane = "default";

  function getCurrentNode() {
    if (!currentNode) {
      throw new Error(
        "No current node found. Ensure you are inside a component.",
      );
    }

    return currentNode;
  }

  function getCurrentSuspenseBoundary(
    hookNode: HookNode,
  ): SuspenseCache | undefined {
    let node = hookNode;

    while (node) {
      const cache = suspenseCaches.get(node.id);
      if (cache) {
        return cache;
      }
      node = node.parent;
    }

    console.error(
      "No suspense boundary found! Available caches:",
      Array.from(suspenseCaches.keys()),
    );
    throw new Error(
      "No Suspense boundary found when calling getCurrentSuspenseBoundary",
    );
  }

  function createSuspenseCache(componentId: string): SuspenseCache {
    const cache = new Map();
    suspenseCaches.set(componentId, cache);
    return cache;
  }

  function getSuspenseCache(componentId: string): SuspenseCache | undefined {
    return suspenseCaches.get(componentId);
  }

  function createNode(id: string, parent?: HookNode): HookNode {
    return {
      id,
      hooks: [],
      hookIndex: 0,
      parent,
      children: new Map(),
      updateQueue: [],
    };
  }

  function enterComponent(componentId: string) {
    let childNode = currentNode.children.get(componentId);
    if (!childNode) {
      childNode = createNode(componentId, currentNode);
      currentNode.children.set(componentId, childNode);
    }

    currentNode = childNode;
    activeNodes.add(componentId);
    currentNode.hookIndex = 0;
  }

  function exitComponent() {
    if (!currentNode) return;

    const parentNode = currentNode.parent;

    if (parentNode) {
      currentNode = parentNode;
    }
  }

  function createElement(
    tag: string | ReactElementTag<Component>,
    props: Props = {},
    ...children: Component[]
  ): Component {
    const isFunc = typeof tag === "function";
    if (!isFunc) return createDomElement(tag, props, children);
    return createReactElement(tag, props, children);
  }

  function createDomElement(
    tag: string,
    props: Props,
    children: Component[],
  ): Component {
    return {
      tag,
      props: mergeProps(props, { children }),
    };
  }

  function createReactElement(
    tag: ReactElementTag<Component>,
    props: Props,
    children: Component[],
  ) {
    if (tag.name === "Suspense") {
      return createSuspenseElement(tag, props, children);
    }

    if (tag.name === "ErrorBoundary") {
      return createErrorBoundaryElement(tag, props, children);
    }

    return {
      tag,
      [ContextSymbol]: tag[ContextSymbol],
      props: mergeProps(props, { children }),
    };
  }

  function createSuspenseElement(
    tag: ReactElementTag<Component>,
    props: Props,
    children: Component[],
  ) {
    return {
      tag,
      [SuspenseSymbol]: true,
      props: mergeProps(props, { children }),
      __suspense: {
        id: currentNode.id,
        fallback: props.fallback,
      },
    };
  }

  function createErrorBoundaryElement(
    tag: ReactElementTag<Component>,
    props: Props,
    children: Component[],
  ) {
    return {
      tag,
      [ErrorBoundarySymbol]: true,
      props: mergeProps(props, { children }),
      __errorBoundary: {
        fallback: props.fallback,
      },
    };
  }

  function createResource<T>(promiseFn: () => Promise<T>, hookNode: HookNode) {
    const hookIndex = hookNode.hookIndex;
    const key = `${hookNode.id}:${hookIndex}`;

    const promiseCache = getCurrentSuspenseBoundary(hookNode);
    let record = promiseCache.get(key) as SuspenseCacheRecord<T> | undefined;

    if (!record) {
      const promise = promiseFn()
        .then((data) => {
          promiseCache.set(key, {
            status: "resolved",
            value: data,
          });
          scheduleRender();
          return data;
        })
        .catch((error) => {
          promiseCache.set(key, {
            status: "rejected",
            error,
          });
          scheduleRender();
          return undefined as T;
        });

      record = {
        status: "pending",
        promise,
      };
      promiseCache.set(key, record as SuspenseCacheRecord<unknown>);
    }

    if (record.status === "pending") {
      throw {
        promise: record.promise,
        key,
      } satisfies SuspenseResource;
    }

    if (record.status === "rejected") {
      throw record.error;
    }

    return record.value;
  }

  function enqueueUpdate(
    update: (arg0: unknown) => unknown,
    index: number,
    hookNode: HookNode,
    lane: Lane = "default",
  ) {
    if (!hookNode) {
      throw new Error("enqueueUpdate called outside of component context");
    }

    hookNode.updateQueue.push({
      hookIndex: index,
      lane,
      apply: (prevState: unknown) => update(prevState),
    });
  }

  function directUpdate(
    update: (arg0: unknown) => void,
    index: number,
    node: HookNode,
  ) {
    if (!node) return;
    node.hooks[index] = update(node.hooks[index]);
  }

  function flushUpdate(targetLane: Lane = "default") {
    processNodeUpdates(rootNode, targetLane);
    resetHookIndices(rootNode);
    scheduledLane = getHighestPendingLane(rootNode);
  }

  function scheduleRender(lane: Lane = "default") {
    scheduledLane = pickLane(scheduledLane, lane);

    if (batchDepth > 0) {
      return;
    }

    if (lane === "sync") {
      flushScheduledRender();
      return;
    }

    if (renderScheduled) {
      return;
    }

    renderScheduled = true;
    queueMicrotask(() => {
      renderScheduled = false;
      flushScheduledRender();
    });
  }

  function flushScheduledRender() {
    if (!scheduledLane) {
      return;
    }

    const nextLane = scheduledLane;
    scheduledLane = null;
    ReactDOM.performWork(nextLane);

    if (scheduledLane) {
      scheduleRender(scheduledLane);
    }
  }

  function queuePassiveEffect(record: PassiveEffectRecord) {
    const existingIndex = pendingPassiveEffects.findIndex(
      (effect) =>
        effect.nodeId === record.nodeId &&
        effect.hookIndex === record.hookIndex,
    );

    if (existingIndex >= 0) {
      pendingPassiveEffects[existingIndex] = record;
      return;
    }

    pendingPassiveEffects.push(record);
  }

  function commitRoot() {
    schedulePassiveEffectsFlush();
    flushTransitionCallbacks();
  }

  function schedulePassiveEffectsFlush() {
    if (pendingPassiveEffects.length === 0 || passiveEffectsScheduled) {
      return;
    }

    passiveEffectsScheduled = true;
    queueMicrotask(() => {
      passiveEffectsScheduled = false;
      flushPassiveEffects();
    });
  }

  function flushPassiveEffects() {
    const effects = pendingPassiveEffects.splice(
      0,
      pendingPassiveEffects.length,
    );

    for (const effect of effects) {
      const hookNode = findNodeById(rootNode, effect.nodeId);
      if (!hookNode) {
        continue;
      }

      const previousState = hookNode.hooks[effect.hookIndex];
      if (isEffectHookState(previousState) && previousState.cleanup) {
        previousState.cleanup();
      }

      const cleanup = effect.create();
      hookNode.hooks[effect.hookIndex] = {
        __type: "effect",
        dependencies: effect.dependencies,
        cleanup,
      } satisfies EffectHookState;
    }
  }

  function batchUpdates<T>(callback: () => T): T {
    batchDepth += 1;

    try {
      return callback();
    } finally {
      batchDepth -= 1;
      if (batchDepth === 0 && scheduledLane) {
        flushScheduledRender();
      }
    }
  }

  function getCurrentUpdateLane() {
    return currentUpdateLane;
  }

  function runWithLane<T>(lane: Lane, callback: () => T): T {
    const previousLane = currentUpdateLane;
    currentUpdateLane = lane;

    try {
      return callback();
    } finally {
      currentUpdateLane = previousLane;
    }
  }

  function startTransition(callback: () => void) {
    return runWithLane("transition", callback);
  }

  function onTransitionComplete(callback: () => void) {
    pendingTransitionCallbacks.push(callback);
  }

  async function act<T>(callback: () => T | Promise<T>) {
    batchDepth += 1;

    try {
      await callback();
    } finally {
      batchDepth -= 1;
    }

    await flushAllWork();
  }

  async function flushAllWork() {
    while (scheduledLane || pendingPassiveEffects.length > 0) {
      if (scheduledLane) {
        flushScheduledRender();
        continue;
      }

      if (pendingPassiveEffects.length > 0) {
        flushPassiveEffects();
        continue;
      }

      await Promise.resolve();
    }
  }

  function startRender() {
    activeNodes.clear();
    activeNodes.add("root");
  }

  function finishRender() {
    cleanupUnusedNodes(rootNode);
  }

  function cleanupUnusedNodes(node: HookNode) {
    if (!node) return;

    const childrenToRemove = [];
    for (const [childId, childNode] of node.children) {
      if (!activeNodes.has(childId)) {
        childrenToRemove.push(childId);
        cleanupNodeSubtree(childNode);
      } else {
        cleanupUnusedNodes(childNode);
      }
    }

    for (const childId of childrenToRemove) {
      node.children.delete(childId);
    }
  }

  function cleanupNodeSubtree(node: HookNode) {
    if (!node) return;

    for (const [_, childNode] of node.children) {
      cleanupNodeSubtree(childNode);
    }

    for (const hook of node.hooks) {
      if (isEffectHookState(hook) && hook.cleanup) {
        hook.cleanup();
      }
    }

    node.children.clear();
    node.hooks = [];
    node.hookIndex = 0;
    node.updateQueue = [];
    suspenseCaches.delete(node.id);
  }

  function processNodeUpdates(node: HookNode | null, targetLane: Lane) {
    if (!node) return;

    const remainingUpdates: HookUpdate[] = [];

    for (const update of node.updateQueue) {
      if (shouldFlushLane(update.lane, targetLane)) {
        node.hooks[update.hookIndex] = update.apply(
          node.hooks[update.hookIndex],
        );
        continue;
      }

      remainingUpdates.push(update);
    }

    node.updateQueue = remainingUpdates;

    for (const [_, child] of node.children) {
      processNodeUpdates(child, targetLane);
    }
  }

  function resetHookIndices(node: HookNode | null) {
    if (!node) return;
    node.hookIndex = 0;
    for (const [_, child] of node.children) {
      resetHookIndices(child);
    }
  }

  function getHookIndex() {
    if (!currentNode) {
      throw new Error("getHookIndex called outside of component context");
    }
    const nextIndex = currentNode.hookIndex++;
    return nextIndex;
  }

  function getStateForIndex<T>(index: number) {
    if (!currentNode) {
      throw new Error("getStateForIndex called outside of component context");
    }
    return [currentNode.hooks[index] as T, currentNode] as const;
  }

  function setStateForIndex(
    index: number,
    newState: unknown,
    hookNode: HookNode,
  ) {
    if (!hookNode) {
      throw new Error("setStateForIndex called outside of component context");
    }
    hookNode.hooks[index] = newState;
  }

  function pushContextValue<T>(metadata: ContextProviderMetadata<T>, value: T) {
    const stack = contextValueStacks.get(metadata.contextId) ?? [];
    stack.push(value);
    contextValueStacks.set(metadata.contextId, stack);
  }

  function popContextValue(contextId: symbol) {
    const stack = contextValueStacks.get(contextId);
    if (!stack || stack.length === 0) {
      return;
    }

    stack.pop();
    if (stack.length === 0) {
      contextValueStacks.delete(contextId);
    }
  }

  function getContextValue<T>(metadata: ContextProviderMetadata<T>) {
    const stack = contextValueStacks.get(metadata.contextId);
    if (!stack || stack.length === 0) {
      return metadata.defaultValue;
    }

    return stack[stack.length - 1] as T;
  }

  function getEffectState(index: number, hookNode: HookNode) {
    const hookState = hookNode.hooks[index];
    if (!isEffectHookState(hookState)) {
      return undefined;
    }

    return hookState;
  }

  function findNodeById(node: HookNode, id: string): HookNode | undefined {
    if (node.id === id) {
      return node;
    }

    for (const [_, childNode] of node.children) {
      const match = findNodeById(childNode, id);
      if (match) {
        return match;
      }
    }

    return undefined;
  }

  function getHighestPendingLane(node: HookNode): Lane | null {
    let highestLane: Lane | null = null;

    for (const update of node.updateQueue) {
      highestLane = pickLane(highestLane, update.lane);
    }

    for (const [_, childNode] of node.children) {
      highestLane = pickLane(highestLane, getHighestPendingLane(childNode));
    }

    return highestLane;
  }

  function hasPendingLane(node: HookNode, lane: Lane): boolean {
    if (node.updateQueue.some((update) => update.lane === lane)) {
      return true;
    }

    for (const [_, childNode] of node.children) {
      if (hasPendingLane(childNode, lane)) {
        return true;
      }
    }

    return false;
  }

  function pickLane(currentLane: Lane | null, candidateLane: Lane | null) {
    if (!candidateLane) {
      return currentLane;
    }

    if (!currentLane) {
      return candidateLane;
    }

    return lanePriority[candidateLane] < lanePriority[currentLane]
      ? candidateLane
      : currentLane;
  }

  function shouldFlushLane(updateLane: Lane, targetLane: Lane) {
    return lanePriority[updateLane] <= lanePriority[targetLane];
  }

  function flushTransitionCallbacks() {
    if (
      pendingTransitionCallbacks.length === 0 ||
      hasPendingLane(rootNode, "transition")
    ) {
      return;
    }

    const callbacks = pendingTransitionCallbacks.splice(
      0,
      pendingTransitionCallbacks.length,
    );
    batchUpdates(() => {
      for (const callback of callbacks) {
        callback();
      }
    });
  }

  function isEffectHookState(value: unknown): value is EffectHookState {
    return (
      value !== null &&
      typeof value === "object" &&
      "__type" in value &&
      (value as EffectHookState).__type === "effect"
    );
  }

  return {
    Fragment: FragmentSymbol,
    Suspense: SuspenseSymbol,
    ErrorBoundary: ErrorBoundarySymbol,
    Context: ContextSymbol,
    generateComponentId,
    mergeProps,
    createResource,
    createElement,
    getHookIndex,
    setStateForIndex,
    flushUpdate,
    enqueueUpdate,
    scheduleRender,
    directUpdate,
    getStateForIndex,
    getEffectState,
    queuePassiveEffect,
    flushPassiveEffects,
    commitRoot,
    batchUpdates,
    act,
    getCurrentUpdateLane,
    startTransition,
    onTransitionComplete,
    pushContextValue,
    popContextValue,
    getContextValue,
    getCurrentNode,
    enterComponent,
    exitComponent,
    startRender,
    finishRender,
    createSuspenseCache,
    getSuspenseCache,
    flushAllWork,
  };
}

const react = React();
globalThis.React = react;
export default react;

export const {
  createElement,
  getHookIndex,
  setStateForIndex,
  flushUpdate,
  enqueueUpdate,
  scheduleRender,
  directUpdate,
  getStateForIndex,
} = react;

export { ErrorBoundary, Suspense } from "./ReactExotic";
export {
  createContext,
  use,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useReducer,
  useRef,
  useState,
  useTransition,
} from "./ReactHooks";
export const { act, startTransition } = react;

export function generateComponentId(
  tag: SyncTag,
  props: Props,
  parentId: string,
): string {
  const tagName = typeof tag === "function" ? tag.name || "Anonymous" : tag;
  const key = props.key;

  const tagIdentifier =
    typeof tag === "function" ? tag.toString().slice(0, 5) : tag;

  const result = [parentId, tagName, key, tagIdentifier]
    .filter(Boolean)
    .map((e) => e?.toString())
    .join("-");

  return hash(result);
}

function hash(str: string) {
  let hash = 0;
  if (str.length === 0) return hash.toString();

  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }

  return Math.abs(hash).toString(36);
}

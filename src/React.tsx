import ReactDOM from "./ReactDOM";
import { mergeProps, recursivelyFindMatchingChild } from "./helpers";
import type { ReactComponent, Component, Props, SyncTag } from "./types";

type HookNode = {
  id: string;
  hooks: unknown[];
  hookIndex: number;
  children: Map<string, HookNode>;
  parent?: HookNode;
};

export function React() {
  let rootNode: HookNode | null = null;
  let currentNode: HookNode | null = null;
  const nodeStack: HookNode[] = [];
  const updateQueue = [];
  const promiseCache = new Map();

  function createNode(id: string, parent?: HookNode): HookNode {
    return {
      id,
      hooks: [],
      hookIndex: 0,
      children: new Map(),
      parent,
    };
  }

  function enterComponent(componentId: string) {
    if (!rootNode) {
      rootNode = createNode("root");
      currentNode = rootNode;
    }

    if (!currentNode) {
      throw new Error("Invalid component hierarchy");
    }

    let childNode = currentNode.children.get(componentId);
    if (!childNode) {
      childNode = createNode(componentId, currentNode);
      currentNode.children.set(componentId, childNode);
    }

    nodeStack.push(currentNode);
    currentNode = childNode;
    currentNode.hookIndex = 0;
  }

  function exitComponent() {
    const parentNode = nodeStack.pop();
    if (parentNode) {
      currentNode = parentNode;
    }
  }

  function createElement(
    tag: string | ((props: Props, children: Component[]) => Component),
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
    children: Component[]
  ): Component {
    return {
      tag,
      children,
      props: mergeProps(props, { children }),
    };
  }

  function createReactElement(
    tag: (props: Props, children: Component[]) => Component,
    props: Props,
    children: Component[]
  ): Component {
    if (tag.name === "Suspense") {
      return createSuspenseElement(tag, props, children);
    }

    const componentId = generateComponentId(tag, props);

    try {
      enterComponent(componentId);

      const result = tag(props, children) as ReactComponent;

      exitComponent();

      return {
        ...result,
        tag,
        children,
        props: mergeProps(props, { children }),
      };
    } catch (e) {
      exitComponent();
      return e;
    }
  }

  function createSuspenseElement(
    tag: (props: Props, children: Component[]) => Component,
    props: Props,
    children: Component[]
  ) {
    const pendingPromise = !!recursivelyFindMatchingChild(
      { children, tag, props },
      (child) => "promise" in Object(child)
    );

    if (pendingPromise) return props.fallback;

    return {
      tag,
      props: mergeProps(props, { children }),
    };
  }

  function createResource<T>(
    promiseFn: () => Promise<T>,
    key: string | number
  ) {
    if (!promiseCache.has(key)) {
      promiseCache.set(
        key,
        promiseFn().then((data) => {
          promiseCache.set(key, data);
          ReactDOM.rerender();
        })
      );
    }

    if (typeof promiseCache.get(key).then === "function")
      throw { promise: promiseCache.get(key), key };

    return promiseCache.get(key);
  }

  function enqueueUpdate(update: (arg0: unknown) => void, index: number) {
    updateQueue.push(() => {
      if (currentNode) {
        const newState = update(currentNode.hooks[index]);
        currentNode.hooks[index] = newState;
      }
    });
  }

  function directUpdate(update: (arg0: unknown) => void, index: number) {
    if (currentNode) {
      const newState = update(currentNode.hooks[index]);
      currentNode.hooks[index] = newState;
    }
  }

  function flushUpdate() {
    let update: () => void;
    while ((update = updateQueue.shift())) update();
    resetHookIndices(rootNode);
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
    return currentNode.hooks[index] as T;
  }

  function setStateForIndex(index: number, newState: unknown) {
    if (!currentNode) {
      throw new Error("setStateForIndex called outside of component context");
    }
    currentNode.hooks[index] = newState;
  }

  return {
    Fragment: Symbol.for("react.fragment"),
    generateComponentId,
    mergeProps,
    createResource,
    createElement,
    getHookIndex,
    setStateForIndex,
    flushUpdate,
    enqueueUpdate,
    directUpdate,
    getStateForIndex,
    promiseCache,
  };
}

const react = React();
export default react;

export const {
  createElement,
  getHookIndex,
  setStateForIndex,
  flushUpdate,
  enqueueUpdate,
  directUpdate,
  getStateForIndex,
  promiseCache,
} = react;

export {
  useEffect,
  useRef,
  useState,
  use,
  useImperativeHandle,
  useContext,
  createContext,
} from "./ReactHooks";
export { Suspense } from "./ReactExotic";

function generateComponentId(tag: SyncTag, props: Props): string {
  const propsHash = hash(safeStringify(props));
  const tagName = typeof tag === "function" ? tag.name || "Anonymous" : tag;
  const key = props.key || propsHash;
  return `${tagName}_${key}`;
}

function hash(str: string) {
  return str.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
}
// Safely stringify props to avoid circular structure errors

function safeStringify(obj: any) {
  const seen = new WeakSet();
  return JSON.stringify(
    obj,
    (_, value) => {
      if (typeof value === "object" && value !== null) {
        if (seen.has(value)) return;
        seen.add(value);
      }
      return value;
    },
    2
  );
}

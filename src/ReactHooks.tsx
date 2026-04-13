import React from "./React";
import type { Children, Component, ContextProviderMetadata } from "./types";

type Factory<T> = () => T;
type State<T> = T | Factory<T>;
type UpdateFunction<T> = (prevState: T) => T;
type Callback = () => undefined | (() => void);
type Dependencies = unknown[];
type ResourceFactory<T> = () => Promise<T>;

type UseState<T> = readonly [T, (newState: T | UpdateFunction<T>) => void];
export function useState<T>(initialState: State<T>): UseState<T> {
  const hookIndex = React.getHookIndex();
  let [state, hookNode] = React.getStateForIndex<T>(hookIndex);

  if (state === undefined) {
    if (typeof initialState === "function") {
      state = (initialState as Factory<T>)();
    } else {
      state = initialState;
    }

    React.setStateForIndex(hookIndex, state, hookNode);
  }

  function setState(newState: T | UpdateFunction<T>) {
    const lane = React.getCurrentUpdateLane();
    if (typeof newState === "function") {
      React.enqueueUpdate(
        newState as UpdateFunction<T>,
        hookIndex,
        hookNode,
        lane,
      );
    } else {
      React.enqueueUpdate(() => newState, hookIndex, hookNode, lane);
    }

    React.scheduleRender(lane);
  }

  return [state, setState];
}

type UseEffectState = {
  __type: "effect";
  dependencies: Dependencies;
  cleanup?: ReturnType<Callback>;
};
export function useEffect(callback: Callback, dependencies: Dependencies) {
  const hookIndex = React.getHookIndex();
  const [, hookNode] = React.getStateForIndex<UseEffectState>(hookIndex);
  const prevState = React.getEffectState(hookIndex, hookNode);

  const prevDependencies = prevState?.dependencies;
  if (dependenciesChanged(prevDependencies, dependencies)) {
    React.queuePassiveEffect({
      nodeId: hookNode.id,
      hookIndex,
      dependencies,
      create: callback,
    });
  }
}

function dependenciesChanged(prev?: Dependencies, current?: Dependencies) {
  if (!current) return true;
  if (!prev || prev.length !== current.length) return true;
  if (prev.length === 0 && current.length === 0) return false;

  return !current.every((dependency, index) => dependency === prev[index]);
}

type Ref<T> = { current: T | null };
export function useRef<T>(initialValue: T) {
  const hookIndex = React.getHookIndex();
  let [ref, hookNode] = React.getStateForIndex(hookIndex);

  if (ref === undefined) {
    ref = { current: initialValue };
    React.setStateForIndex(hookIndex, ref, hookNode);
  }

  return ref as Ref<T>;
}

export function use<T>(resource: Context<T> | ResourceFactory<T>): T {
  if ("_contextId" in resource) {
    return useContext(resource as Context<T>);
  }

  const hookNode = React.getCurrentNode();
  return React.createResource(resource as ResourceFactory<T>, hookNode);
}

export function useReducer<T, A>(
  reducer: (state: T, action: A) => T,
  initialState: T,
): [T, (action: A) => void] {
  const hookIndex = React.getHookIndex();
  let [state, hookNode] = React.getStateForIndex<T>(hookIndex);

  if (state === undefined) {
    state = initialState;
    React.setStateForIndex(hookIndex, state, hookNode);
  }

  function dispatch(action: A) {
    const lane = React.getCurrentUpdateLane();
    React.enqueueUpdate(
      (currentState: T) => reducer(currentState, action),
      hookIndex,
      hookNode,
      lane,
    );
    React.scheduleRender(lane);
  }

  return [state, dispatch];
}

type UseTransition = readonly [boolean, (callback: () => void) => void];
export function useTransition(): UseTransition {
  const [isPending, setIsPending] = useState(false);

  function start(callback: () => void) {
    setIsPending(true);
    React.startTransition(() => {
      callback();
      React.onTransitionComplete(() => setIsPending(false));
    });
  }

  return [isPending, start];
}

export function useMemo<T>(factory: () => T, dependencies: Dependencies): T {
  const hookIndex = React.getHookIndex();
  const [prevState, hookNode] =
    React.getStateForIndex<[Dependencies, T]>(hookIndex);

  const [prevDependencies, memoizedValue] = prevState || [[], factory()];
  if (dependenciesChanged(prevDependencies, dependencies)) {
    const value = factory();
    React.setStateForIndex(hookIndex, [dependencies, value], hookNode);
    return value;
  }

  return memoizedValue;
}

// biome-ignore lint/suspicious/noExplicitAny: needed for generic callback
export function useCallback<T extends (...args: any[]) => any>(
  callback: T,
  dependencies: Dependencies,
): T {
  return useMemo(() => callback, dependencies);
}

type InternalContext<T> = {
  _contextId: symbol;
  _currentValue: T;
  _metadata: ContextProviderMetadata<T>;
  Provider: ContextProviderComponent<T>;
};

type Context<T> = Pick<InternalContext<T>, "Provider">;

type ContextProviderComponent<T> = ((props: {
  children?: Children;
  value: T;
}) => Component) & {
  _contextId?: symbol;
  _defaultValue?: T;
};

export function createContext<T>(defaultValue: T) {
  const contextId = Symbol("context-state");

  function Provider(props: { children?: Children; value: T }) {
    return <>{props.children}</>;
  }

  Provider[React.Context] = true;
  Provider._contextId = contextId;
  Provider._defaultValue = defaultValue;
  return {
    _contextId: contextId,
    _currentValue: defaultValue,
    _metadata: {
      contextId,
      defaultValue,
    },
    Provider,
  } as Context<T>;
}

export function useContext<T>(context: Context<T>): T {
  return React.getContextValue((context as InternalContext<T>)._metadata);
}

export function useImperativeHandle<T>(
  ref: Ref<T>,
  createHandle: () => T,
  dependencies?: Dependencies,
) {
  const hookIndex = React.getHookIndex();
  const [prevDependencies, hookNode] =
    React.getStateForIndex<Dependencies>(hookIndex);

  if (dependenciesChanged(prevDependencies, dependencies)) {
    React.setStateForIndex(hookIndex, dependencies, hookNode);
    ref.current = createHandle();
  }
}

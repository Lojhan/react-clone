import React from "./React";
import ReactDOM from "./ReactDOM";
import type { Children } from "./types";

type State<T> = T | (() => T);
type UpdateFunction<T> = (prevState: T) => T;
type Callback = () => void | (() => void);

export function useState<T>(
  initialState: State<T>
): [T, (newState: T | ((prevState: T) => T)) => void] {
  const hookIndex = React.getHookIndex();
  let state: T = React.getStateForIndex(hookIndex);

  if (typeof initialState === "function" && !state) {
    state = (initialState as () => T)();
  } else if (!state) {
    state = initialState as T;
    React.setStateForIndex(hookIndex, state);
  }

  function setState(newState: T | UpdateFunction<T>) {
    if (typeof newState === "function") {
      React.enqueueUpdate(newState as UpdateFunction<T>, hookIndex);
    } else {
      React.directUpdate(() => newState, hookIndex);
      state = newState;
    }

    ReactDOM.rerender();
  }

  return [state, setState];
}

export function useEffect(callback: Callback, dependencies: unknown[]) {
  const hookIndex = React.getHookIndex();
  const prevDependencies = React.getStateForIndex(hookIndex);
  let cleanupFunction: ReturnType<Callback> | undefined;
  if (dependenciesChanged(prevDependencies, dependencies)) {
    React.setStateForIndex(hookIndex, dependencies);
    cleanupFunction = callback();
    if (cleanupFunction) cleanupFunction();
  }
}

function dependenciesChanged(
  prevDependencies: unknown[],
  dependencies: unknown[]
) {
  if (!prevDependencies) return true;
  return !dependencies.every(
    (dependency, index) => dependency === prevDependencies[index]
  );
}

export function useRef<T>(initialValue: T) {
  const hookIndex = React.getHookIndex();
  let ref = React.getStateForIndex(hookIndex);

  if (!ref) {
    ref = { current: initialValue };
    React.setStateForIndex(hookIndex, ref);
  }

  return ref as { current: T };
}

export function use<T>(promiseFn: () => Promise<T>, key: string): T {
  return React.createResource(promiseFn, key);
}

export function useReducer<T, A>(
  reducer: (state: T, action: A) => T,
  initialState: T
): [T, (action: A) => void] {
  const hookIndex = React.getHookIndex();
  let state: T = React.getStateForIndex(hookIndex);

  if (!state) {
    state = initialState;
    React.setStateForIndex(hookIndex, state);
  }

  function dispatch(action: A) {
    const newState = reducer(state, action);
    React.directUpdate(() => newState, hookIndex);
    state = newState;
    ReactDOM.rerender();
  }

  return [state, dispatch];
}

export function useMemo<T>(factory: () => T, dependencies: unknown[]): T {
  const hookIndex = React.getHookIndex();
  const prevDependencies = React.getStateForIndex(hookIndex);
  if (dependenciesChanged(prevDependencies, dependencies)) {
    React.setStateForIndex(hookIndex, dependencies);
    return factory();
  }
  return React.getStateForIndex(hookIndex);
}

export function useCallback<T extends (...args: any[]) => any>(
  callback: T,
  dependencies: unknown[]
): T {
  return useMemo(() => callback, dependencies);
}

export function createContext<T>(defaultValue: T) {
  const context = {
    _currentValue: defaultValue,
    Provider: (props: { children?: Children, value: T }) => {
      context._currentValue = props.value;
      return props.children;
    },
  };
  return context;
}

export function useContext<T>(context: { _currentValue: T }) {
  return context._currentValue;
}

export function useImperativeHandle<T>(
  ref: { current: T | null },
  createHandle: () => T,
  dependencies?: unknown[]
) {
  const hookIndex = React.getHookIndex();
  const prevDependencies = React.getStateForIndex(hookIndex);
  if (dependenciesChanged(prevDependencies, dependencies)) {
    React.setStateForIndex(hookIndex, dependencies);
    ref.current = createHandle();
  }
}

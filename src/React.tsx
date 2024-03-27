import ReactDOM from "./ReactDOM";
import { mergeProps, recursivelyFindMatchingChild } from "./helpers";
import type { ReactComponent, Component, Props } from "./types";

export function React() {
  const state = [];
  const updateQueue = [];
  const promiseCache = new Map();
  let hookIndex = 0;

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
    if (tag.name === "Suspense")
      return createSuspenseElement(tag, props, children);

    try {
      return {
        ...(tag(props, children) as ReactComponent),
        tag,
        children,
        props: mergeProps(props, { children }),
      };
    } catch (e) {
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

  function createResource<T>(promiseFn: () => Promise<T>, key: string) {
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
      const newState = update(state[index]);
      state[index] = newState;
    });
  }

  function directUpdate(update: (arg0: unknown) => void, index: number) {
    const newState = update(state[index]);
    state[index] = newState;
  }

  function flushUpdate() {
    let update: () => void;
    while ((update = updateQueue.shift())) update();
    hookIndex = 0;
  }

  const getHookIndex = () => {
    const nextIndex = hookIndex++;
    console.log("hookIndex", nextIndex);
    return nextIndex;
  };

  const getStateForIndex = (index: number) => state[index];
  
  const setStateForIndex = (index: number, newState: unknown) => {
    state[index] = newState;
  };

  return {
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

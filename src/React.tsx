import ReactDOM from "./ReactDOM";
import { mergeProps, recursivelyFindMatchingChild } from "./helpers";
import type { ReactComponent, Component, Props } from "./types";

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
  const componentInstanceMap = new WeakMap();

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

  function generateComponentId(tag: any, props: Props): string {
    const propsHash = hash(safeStringify(props));
    const tagName = typeof tag === "function" ? tag.name || "Anonymous" : tag;
    const key = props.key || propsHash;
    return `${tagName}_${key}`;
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

    // Check if we're already rendering this component to prevent infinite loops
    if (
      componentInstanceMap.has(tag) &&
      componentInstanceMap.get(tag) === componentId
    ) {
      console.warn(
        `Potential infinite loop detected for component ${componentId}`
      );
      return {
        tag: "div",
        props: { children: ["Error: Infinite loop detected"] },
        children: [],
      };
    }

    try {
      componentInstanceMap.set(tag, componentId);
      enterComponent(componentId);

      const result = tag(props, children) as ReactComponent;

      exitComponent();
      componentInstanceMap.delete(tag);

      return {
        ...result,
        tag,
        children,
        props: mergeProps(props, { children }),
      };
    } catch (e) {
      exitComponent();
      componentInstanceMap.delete(tag);
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
    node.children.forEach((child) => resetHookIndices(child));
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

  const setStateForIndex = (index: number, newState: unknown) => {
    if (!currentNode) {
      throw new Error("setStateForIndex called outside of component context");
    }
    currentNode.hooks[index] = newState;
  };

  // Debug function to visualize the tree
  const debugTree = () => {
    function printNode(node: HookNode, depth = 0) {
      const indent = "  ".repeat(depth);
      console.log(`${indent}${node.id}: [${node.hooks.length} hooks]`);
      node.children.forEach((child) => printNode(child, depth + 1));
    }
    if (rootNode) {
      console.log("Hook Tree:");
      printNode(rootNode);
    }
  };

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
    debugTree, // Export debug function
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
  debugTree,
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

const hash = (str: string) =>
  str.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
// Safely stringify props to avoid circular structure errors
function safeStringify(obj: any) {
  const seen = new WeakSet();
  return JSON.stringify(
    obj,
    function (key, value) {
      if (typeof value === "object" && value !== null) {
        if (seen.has(value)) return;
        seen.add(value);
      }
      return value;
    },
    2
  );
}

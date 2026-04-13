import {
  isErrorBoundaryComponent,
  isContextProvider,
  isFragment,
  isPrimitive,
  isSuspenseComponent,
  isSuspenseResource,
} from "./helpers";
import React from "./React";
import type {
  Component,
  ContextProviderMetadata,
  ErrorBoundaryComponent,
  ErrorBoundaryFallback,
  Lane,
  Props,
  ReactElementTag,
  ReactComponent,
  SuspenseComponent,
  SyncTag,
} from "./types";

type VNode = {
  type: string | ((props: unknown) => unknown) | symbol;
  props: Props;
  children?: VNode[];
  domElement?: HTMLElement | Text;
  key?: string | number;
  componentId?: string;
};

type ChildMatch = {
  child: VNode;
  index: number;
};

type FunctionReactComponent = ReactComponent & {
  tag: ReactElementTag<Component>;
};

type ContextProviderTag = FunctionReactComponent["tag"] & {
  _contextId?: symbol;
  _defaultValue?: unknown;
};

function ReactDOM() {
  let _root: Component;
  let _container: HTMLElement;
  let _currentTree: VNode | null = null;

  function renderRoot(root: Component, container: HTMLElement) {
    if (!root) throw new Error("No root component provided");
    if (_container && _container !== container) {
      _currentTree = null;
    }

    _root = root;
    _container = container;
    performRender();
  }

  function performRender() {
    if (!_root || !_container) {
      return;
    }

    React.startRender();
    const newTree = createVirtualTree(_root);

    if (newTree) {
      reconcile(newTree, _currentTree, _container);
    }

    _currentTree = newTree;
    React.finishRender();
    React.commitRoot();
  }

  function performWork(lane: Lane = "default") {
    React.flushUpdate(lane);
    performRender();
  }

  function rerender() {
    React.scheduleRender("sync");
  }

  function createVirtualTree(component: Component): VNode | null {
    if (!component) return null;

    if (isPrimitive(component)) {
      return createVNode(
        "TEXT_ELEMENT",
        { nodeValue: component.toString() },
        [],
      );
    }

    if (Array.isArray(component)) {
      return createVNode(React.Fragment, {}, createChildren(component));
    }

    if (isFragment(component.tag, component.props)) {
      return createVNode(
        React.Fragment,
        component.props,
        createChildren(component.props.children),
      );
    }

    if (isSuspenseComponent(component)) {
      return createSuspenseVNode(component);
    }

    if (isErrorBoundaryComponent(component)) {
      return createErrorBoundaryVNode(component);
    }

    if (typeof component.tag === "function") {
      return createComponentVNode(component as FunctionReactComponent);
    }

    return createVNode(
      component.tag,
      component.props,
      createChildren(component.props.children),
    );
  }

  function createVNode(
    type: VNode["type"],
    props: Props,
    children: VNode[],
    componentId?: string,
  ): VNode {
    return {
      type,
      props,
      children,
      key: props.key,
      componentId,
    };
  }

  function createChildren(children: Component[] = []): VNode[] {
    return children
      .map((child) => createVirtualTree(child))
      .filter((child): child is VNode => child !== null);
  }

  function createComponentVNode(component: FunctionReactComponent) {
    const componentId = getComponentId(
      component.tag as SyncTag,
      component.props,
    );

    React.enterComponent(componentId);
    let result: VNode | null = null;

    try {
      result = isContextProvider(component)
        ? renderContextProvider(component)
        : renderFunctionComponent(component);
    } finally {
      React.exitComponent();
    }

    if (isContextProvider(component)) {
      return createVNode(
        React.Context,
        component.props,
        result ? [result] : [],
        componentId,
      );
    }

    return result
      ? {
          ...result,
          key: component.props.key ?? result.key,
          componentId,
        }
      : null;
  }

  function renderFunctionComponent(component: FunctionReactComponent) {
    const rendered = component.tag(component.props) as Component;
    return createVirtualTree(rendered);
  }

  function renderContextProvider(component: FunctionReactComponent) {
    const metadata = getContextProviderMetadata(
      component.tag as ContextProviderTag,
    );
    React.pushContextValue(
      metadata,
      component.props.value ?? metadata.defaultValue,
    );

    try {
      return renderFunctionComponent(component);
    } finally {
      React.popContextValue(metadata.contextId);
    }
  }

  function getContextProviderMetadata(tag: ContextProviderTag) {
    if (tag._contextId === undefined) {
      throw new Error("Context provider is missing _contextId metadata");
    }

    return {
      contextId: tag._contextId,
      defaultValue: tag._defaultValue,
    } satisfies ContextProviderMetadata;
  }

  function createSuspenseVNode(component: SuspenseComponent) {
    const componentId = getComponentId(
      component.tag as SyncTag,
      component.props,
    );

    if (!React.getSuspenseCache(componentId)) {
      React.createSuspenseCache(componentId);
    }

    React.enterComponent(componentId);

    let shouldShowFallback = false;
    let children: VNode[] = [];

    try {
      children = createChildren(component.props.children);
    } catch (error) {
      if (isSuspenseResource(error)) {
        shouldShowFallback = true;
      } else {
        React.exitComponent();
        throw error;
      }
    }

    React.exitComponent();

    if (shouldShowFallback) {
      const fallback = createVirtualTree(component.__suspense.fallback);
      return createVNode(
        React.Suspense,
        component.props,
        fallback ? [fallback] : [],
        componentId,
      );
    }

    return createVNode(React.Suspense, component.props, children, componentId);
  }

  function createErrorBoundaryVNode(component: ErrorBoundaryComponent) {
    const componentId = getComponentId(
      component.tag as SyncTag,
      component.props,
    );

    React.enterComponent(componentId);

    try {
      const children = createChildren(component.props.children);
      return createVNode(
        React.ErrorBoundary,
        component.props,
        children,
        componentId,
      );
    } catch (error) {
      if (isSuspenseResource(error)) {
        throw error;
      }

      const fallback = resolveErrorBoundaryFallback(
        component.__errorBoundary?.fallback,
        error,
      );
      const fallbackTree = createVirtualTree(fallback);
      return createVNode(
        React.ErrorBoundary,
        component.props,
        fallbackTree ? [fallbackTree] : [],
        componentId,
      );
    } finally {
      React.exitComponent();
    }
  }

  function resolveErrorBoundaryFallback(
    fallback: ErrorBoundaryFallback | undefined,
    error: unknown,
  ): Component {
    if (!fallback) {
      return String(error);
    }

    return typeof fallback === "function" ? fallback(error) : fallback;
  }

  function getComponentId(tag: SyncTag, props: Props) {
    const parentId = React.getCurrentNode().id;
    return React.generateComponentId(tag, props, parentId);
  }

  function reconcile(
    newNode: VNode | null,
    oldNode: VNode | null,
    container: HTMLElement,
  ): void {
    if (!newNode && oldNode) {
      removeElement(oldNode, container);
      return;
    }

    if (newNode && !oldNode) {
      const element = createElement(newNode);
      newNode.domElement = element;
      container.appendChild(element);
      return;
    }

    if (newNode && oldNode) {
      if (canReuse(newNode, oldNode)) {
        newNode.domElement = oldNode.domElement;

        if (typeof newNode.type === "string" && newNode.domElement) {
          updateElement(newNode.domElement, oldNode.props, newNode.props);
        }

        reconcileChildren(
          newNode,
          oldNode,
          newNode.domElement instanceof HTMLElement
            ? newNode.domElement
            : container,
        );
      } else {
        const newElement = createElement(newNode);
        newNode.domElement = newElement;
        if (oldNode.domElement) {
          container.replaceChild(newElement, oldNode.domElement);
        } else {
          container.appendChild(newElement);
        }
      }
    }
  }

  function canReuse(newNode: VNode, oldNode: VNode): boolean {
    return (
      newNode.type === oldNode.type &&
      newNode.key === oldNode.key &&
      newNode.componentId === oldNode.componentId
    );
  }

  function reconcileChildren(
    newNode: VNode,
    oldNode: VNode,
    container: HTMLElement,
  ): void {
    const newChildren = newNode.children || [];
    const oldChildren = oldNode.children || [];
    const remainingKeyed = new Map<string | number, ChildMatch>();
    const remainingUnkeyed: ChildMatch[] = [];

    for (let index = 0; index < oldChildren.length; index++) {
      const child = oldChildren[index];
      if (child.key !== undefined) {
        remainingKeyed.set(child.key, { child, index });
        continue;
      }

      remainingUnkeyed.push({ child, index });
    }

    for (let index = 0; index < newChildren.length; index++) {
      const newChild = newChildren[index];
      const match = findMatchingChild(
        newChild,
        index,
        remainingKeyed,
        remainingUnkeyed,
      );
      reconcile(newChild, match?.child ?? null, container);
      placeChild(container, newChild, index);
    }

    for (const { child } of remainingKeyed.values()) {
      removeElement(child, container);
    }

    for (const { child } of remainingUnkeyed) {
      removeElement(child, container);
    }
  }

  function findMatchingChild(
    newChild: VNode,
    index: number,
    remainingKeyed: Map<string | number, ChildMatch>,
    remainingUnkeyed: ChildMatch[],
  ): ChildMatch | undefined {
    if (newChild.key !== undefined) {
      const keyedMatch = remainingKeyed.get(newChild.key);
      if (keyedMatch) {
        remainingKeyed.delete(newChild.key);
        return keyedMatch;
      }

      return undefined;
    }

    const nextUnkeyedIndex = remainingUnkeyed.findIndex(
      (match) => match.index >= index || match.child.key === undefined,
    );
    if (nextUnkeyedIndex === -1) {
      return undefined;
    }

    const [match] = remainingUnkeyed.splice(nextUnkeyedIndex, 1);
    return match;
  }

  function placeChild(container: HTMLElement, child: VNode, index: number) {
    if (!child.domElement) {
      return;
    }

    const currentChild = container.childNodes[index] ?? null;
    if (currentChild !== child.domElement) {
      container.insertBefore(child.domElement, currentChild);
    }
  }

  function createElement(vnode: VNode): HTMLElement | Text {
    if (vnode.type === "TEXT_ELEMENT") {
      return document.createTextNode(vnode.props.nodeValue || "");
    }

    if (isSpecialComponent(vnode.type)) {
      const fragment = document.createDocumentFragment();
      for (const child of vnode.children || []) {
        const childElement = createElement(child);
        child.domElement = childElement;
        fragment.appendChild(childElement);
      }

      const div = document.createElement("div");
      div.style.display = "contents";
      div.appendChild(fragment);
      return div;
    }

    if (typeof vnode.type === "string") {
      const element = document.createElement(vnode.type);
      updateElement(element, {}, vnode.props);

      for (const child of vnode.children || []) {
        const childElement = createElement(child);
        child.domElement = childElement;
        element.appendChild(childElement);
      }

      return element;
    }

    throw new Error(`Unknown element type: ${String(vnode.type)}`);
  }

  function updateElement(
    element: HTMLElement | Text,
    oldProps: Props,
    newProps: Props,
  ): void {
    if (element instanceof Text) {
      if (oldProps.nodeValue !== newProps.nodeValue) {
        element.nodeValue = String(newProps.nodeValue || "");
      }
      return;
    }

    const htmlElement = element as HTMLElement;

    const excludedKeys = ["__source", "__self"];

    for (const name of Object.keys(oldProps).filter(
      (key) => !excludedKeys.includes(key),
    )) {
      if (name === "children" || !(name in newProps)) continue;
      if (name.startsWith("on")) {
        const eventType = name.toLowerCase().substring(2);
        htmlElement.removeEventListener(eventType, oldProps[name]);
      } else if (name === "className") {
        htmlElement.className = "";
      } else if (name === "style") {
        htmlElement.removeAttribute("style");
      } else {
        htmlElement.removeAttribute(name);
      }
    }

    for (const name of Object.keys(newProps).filter(
      (key) => !excludedKeys.includes(key),
    )) {
      if (name === "children" || name === "key") continue;
      if (name.startsWith("on")) {
        const eventType = name.toLowerCase().substring(2);
        if (oldProps[name]) {
          htmlElement.removeEventListener(eventType, oldProps[name]);
        }
        htmlElement.addEventListener(eventType, newProps[name]);
      } else if (name === "className") {
        htmlElement.className = newProps[name] || "";
      } else if (name === "style") {
        if (typeof newProps[name] === "string") {
          htmlElement.style.cssText = newProps[name];
        } else if (typeof newProps[name] === "object") {
          Object.assign(htmlElement.style, newProps[name]);
        }
      } else if (name === "ref") {
        if (newProps[name] && typeof newProps[name] === "object") {
          newProps[name].current = htmlElement;
        }
      } else {
        htmlElement.setAttribute(name, String(newProps[name]));
      }
    }
  }

  function removeElement(vnode: VNode, _: HTMLElement): void {
    if (vnode.domElement?.parentNode) {
      vnode.domElement.parentNode.removeChild(vnode.domElement);
    }
  }

  function isSpecialComponent(type: VNode["type"]): boolean {
    return (
      type === React.Fragment ||
      type === React.Suspense ||
      type === React.ErrorBoundary ||
      type === React.Context
    );
  }

  return {
    renderRoot,
    performWork,
    rerender,
  };
}

export default ReactDOM();

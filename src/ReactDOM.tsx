import React from "./React";
import { isFragment, isPrimitive, isServerComponent } from "./helpers";
import type { Children, Component, Props, ReactComponent } from "./types";

type VNode = {
  type: string | Function | Symbol;
  props: Props;
  children?: VNode[];
  domElement?: HTMLElement | Text;
  key?: string | number;
};

function ReactDOM() {
  let _root: Component;
  let _container: HTMLElement;
  let _currentTree: VNode | null = null;

  function renderRoot(root: Component, container: HTMLElement) {
    if (!root) throw new Error("No root component provided");
    React.flushUpdate();

    _root = root;
    _container = container;

    const newTree = createVirtualTree(_root);

    if (newTree) renderToDOM(_currentTree, newTree, container);

    _currentTree = newTree;
  }

  const rerender = () => renderRoot(_root, _container);

  return {
    renderRoot,
    rerender,
    renderToHTMLString,
  };
}

export default ReactDOM();

function createVirtualTree(component: Component): VNode | null {
  if (!component) return null;

  if (isPrimitive(component)) {
    return {
      type: "TEXT_ELEMENT",
      props: { nodeValue: component.toString() },
      children: [],
    };
  }

  if (Array.isArray(component)) {
    return {
      type: React.Fragment,
      props: { children: [] },
      children: component.map(createVirtualTree).filter(Boolean),
    };
  }

  if (isFragment(component.tag, component.props)) {
    return {
      type: React.Fragment,
      props: component.props,
      children: component.props.children.map(createVirtualTree).filter(Boolean),
    };
  }

  if (isServerComponent(component.tag, component.props)) {
    throw new Error("Cannot render server component on client");
  }

  if (typeof component.tag === "function") {
    const el = component.tag(component.props);
    return createVirtualTree(el);
  }

  return {
    type: component.tag,
    props: { ...component.props, children: [] },
    children: component.props.children.map(createVirtualTree).filter(Boolean),
  };
}

function renderToDOM(
  oldvnode: VNode | null,
  newvnode: VNode | null,
  container: HTMLElement
): void {
  if (!newvnode) return;

  if (!oldvnode) {
    if (newvnode.type === "TEXT_ELEMENT") {
      const textNode = createTextNode(newvnode.props.nodeValue);
      newvnode.domElement = textNode;
      container.appendChild(textNode);
      return;
    }

    if (newvnode.type === React.Fragment) {
      newvnode.children?.forEach((child, index) =>
        renderToDOM(oldvnode?.children?.[index] || null, child, container)
      );
      return;
    }

    if (typeof newvnode.type === "string") {
      const domElement = createDomElement(newvnode.type, newvnode.props);
      newvnode.domElement = domElement;
      container.appendChild(domElement);
      newvnode.children?.forEach((child) =>
        renderToDOM(
          oldvnode?.children?.find((c) => c.key === child.key) || null,
          child,
          domElement
        )
      );
    }
    return;
  }

  if (oldvnode.type !== newvnode.type) {
    if (oldvnode.domElement && oldvnode.domElement.parentNode) {
      oldvnode.domElement.parentNode.removeChild(oldvnode.domElement);
    }
    renderToDOM(null, newvnode, container);
    return;
  }

  if (newvnode.type === "TEXT_ELEMENT") {
    const textNode = oldvnode.domElement as Text;
    if (textNode.nodeValue !== newvnode.props.nodeValue) {
      textNode.nodeValue = newvnode.props.nodeValue;
    }
    newvnode.domElement = textNode;
    return;
  }

  if (typeof newvnode.type === "string") {
    const domElement = oldvnode.domElement as HTMLElement;
    newvnode.domElement = domElement;

    updateDomElement(domElement, oldvnode.props, newvnode.props);

    const oldChildren = oldvnode.children || [];
    const newChildren = newvnode.children || [];

    reconcileChildren(oldChildren, newChildren, domElement);
    return;
  }

  if (newvnode.type === React.Fragment) {
    const oldChildren = oldvnode.children || [];
    const newChildren = newvnode.children || [];

    reconcileChildren(oldChildren, newChildren, container);
    return;
  }
}

function reconcileChildren(
  oldChildren: VNode[],
  newChildren: VNode[],
  container: HTMLElement
): void {
  // Create a map of old children by key for efficient lookup
  const oldChildrenMap: Map<string | number, VNode> = new Map();
  const oldChildrenWithoutKey: VNode[] = [];

  oldChildren.forEach((child) => {
    if (child.key != null) {
      oldChildrenMap.set(child.key, child);
    } else {
      oldChildrenWithoutKey.push(child);
    }
  });

  // Keep track of processed old nodes to find removed nodes later
  const processedOldNodes = new Set();

  // Process new children
  newChildren.forEach((newChild, i) => {
    let oldChild = null;

    // Try to find matching old child by key
    if (newChild.key != null && oldChildrenMap.has(newChild.key)) {
      oldChild = oldChildrenMap.get(newChild.key)!;
      processedOldNodes.add(oldChild);
    } else {
      // If no key or key not found, fall back to index-based matching
      oldChild = oldChildrenWithoutKey[i] || null;
      if (oldChild) processedOldNodes.add(oldChild);
    }

    renderToDOM(oldChild, newChild, container);
  });

  // Remove any old children that weren't processed (they were removed)
  oldChildren.forEach((oldChild) => {
    if (!processedOldNodes.has(oldChild) && oldChild.domElement) {
      oldChild.domElement.parentNode?.removeChild(oldChild.domElement);
    }
  });
}

function createTextNode(value: string | number) {
  return document.createTextNode(value.toString());
}

function createDomElement(tag: string, props: Props) {
  const element = document.createElement(tag);

  Object.keys(props)
    .filter((key) => key !== "children")
    .forEach((key) => (element[key.toLowerCase()] = props[key]));

  if (props.style) {
    if (typeof props.style === "string") {
      element.style.cssText = props.style;
    } else if (typeof props.style === "object") {
      Object.keys(props.style).forEach((styleKey) => {
        const styleValue = props.style[styleKey];
        if (styleValue !== undefined) {
          element.style[styleKey as any] = styleValue;
        }
      });
    }
  }

  const classList =
    props.className?.split(" ").filter((e: string) => e !== "") ?? [];
  if (classList.length > 0) element.classList.add(...classList);
  if (props.ref) props.ref.current = element;
  return element;
}

function updateDomElement(
  element: HTMLElement,
  oldProps: Props,
  newProps: Props
): void {
  // Update or add properties from new props
  Object.keys(newProps)
    .filter((key) => key !== "children")
    .forEach((key) => {
      if (element[key.toLowerCase()] !== newProps[key]) {
        element[key.toLowerCase()] = newProps[key];
      }
    });

  // Remove properties that exist in old props but not in new props
  Object.keys(oldProps)
    .filter((key) => key !== "children" && !(key in newProps))
    .forEach((key) => {
      element[key.toLowerCase()] = "";
    });

  // Handle style updates
  if (newProps.style) {
    if (typeof newProps.style === "string") {
      element.style.cssText = newProps.style;
    } else if (typeof newProps.style === "object") {
      Object.keys(newProps.style).forEach((styleKey) => {
        const styleValue = newProps.style[styleKey];
        if (styleValue !== undefined) {
          element.style[styleKey as any] = styleValue;
        }
      });
    }
  }

  // Update className if present
  const classList =
    newProps.className?.split(" ").filter((e: string) => e !== "") ?? [];
  if (classList.length > 0) {
    // Clear old classes first to prevent duplicates
    if (oldProps.className) {
      element.className = "";
    }
    element.classList.add(...classList);
  }

  // Update ref if present
  if (newProps.ref) {
    newProps.ref.current = element;
  }
}

async function renderToHTMLString(
  component: Component | ReactComponent | Children
): Promise<string> {
  if (!component) return "";

  if (typeof component === "string" || typeof component === "number") {
    return component.toString();
  }

  if (Array.isArray(component)) {
    const elements = await Promise.all(component.map(renderToHTMLString));
    return elements.join("");
  }

  if (typeof component.tag === "function") {
    const element = await component.tag(component.props, component.children);
    return await renderToHTMLString(element);
  }

  return createHTMLString(component.tag, component.props);
}

async function createHTMLString(tag: string, props: Props) {
  const excluded = ["children", "ref", "__self", "__source"];

  if (props.className) {
    props.class = props.className;
    delete props.className;
  }

  if (props.style) {
    if (typeof props.style === "string") {
      props.style = props.style;
    } else if (typeof props.style === "object") {
      props.style = Object.entries(props.style)
        .map(([key, value]) => `${key}: ${value};`)
        .join(" ");
    }
  }

  const tagProps = Object.keys(props)
    .filter((key) => excluded.indexOf(key) == -1)
    .map((key) => `${key.toLowerCase()}="${props[key]}"`)
    .join(" ")
    .trim();

  const openTag = `<${tag} ${tagProps}>`;
  const closeTag = `</${tag}>`;

  let awaitedChildren: string[] = [];

  if (props.children) {
    const promises = props.children.map(renderToHTMLString);
    awaitedChildren = await Promise.all(promises);
  }

  const children = awaitedChildren.join("");
  return `${openTag}${children}${closeTag}`;
}
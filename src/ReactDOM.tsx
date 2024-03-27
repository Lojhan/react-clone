import React from "./React";
import { isServerComponent } from "./helpers";
import type { Children, ReactComponent, Component, Props, Tag } from "./types";


function ReactDOM() {
  let _root: Component;
  let _container: HTMLElement;

  function render(component: Component, container: HTMLElement): void {
    if (!component) return;

    if (typeof component === "string" || typeof component === "number") {
      container.appendChild(createTextNode(component));
      return;
    }

    if (Array.isArray(component)) {
      return component.forEach((e) => render(e, container));
    }

    if (
      isServerComponent(component.tag, component.props)
    ) {
      throw new Error("Cannot render server component on client");
    }

    if (typeof component.tag === "function") {
      const el = component.tag(component.props);
      return render(el, container);
    }

    const el = createDomElement(component.tag, component.props);
    container.appendChild(el);
  }

  async function renderToHTMLString(component: Component | ReactComponent | Children): Promise<string> {
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

  function createDomElement(tag: string, props: Props) {
    const element = document.createElement(tag);

    Object.keys(props)
      .filter((key) => key !== "children")
      .forEach((key) => (element[key.toLowerCase()] = props[key]));

    const classList = props.className?.split(" ").filter((e: string) => e !== "") ?? [];
    if (classList.length > 0) element.classList.add(...classList);
    props.children.forEach((child) => render(child, element));
    if (props.ref) props.ref.current = element;
    return element;
  }

  function createTextNode(inner: string | number) {
    return document.createTextNode(inner.toString());
  }

  function renderRoot(root: Component, container: HTMLElement) {
    _root ??= root;
    if (!root) throw new Error("No root component provided");
    _container ??= container;
    container.innerHTML = "";
    React.flushUpdate();
    render(root, container);
  }

  function rerender() {
    React.flushUpdate();
    renderRoot(_root, _container);
  }

  async function createHTMLString(tag: string, props: Props) {
    const excluded = ["children", "ref", "__self", "__source"];

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

  return {
    render,
    renderRoot,
    rerender,
    renderToHTMLString,
  };
}

export default ReactDOM();

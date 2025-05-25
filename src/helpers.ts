import React from "./React";
import type { AsyncTag, ReactComponent, Component, Props, Tag } from "./types";

export function recursivelyFindMatchingChild(
  node: ReactComponent,
  predicate: (node: Component) => boolean
): ReactComponent | null {
  if (predicate(node)) return node;
  if (!node.children) return null;

  for (const child of node.children) {
    if (!child) continue;
    if (typeof child === "string" || typeof child === "number") continue;
    const match = recursivelyFindMatchingChild(child, predicate);
    if (match) return match;
  }
}

export function recursivelyBuildChildren(children: Component[]) {
  return children
    .filter((e) => e !== undefined)
    .map((child) => {
      if (typeof child === "string" || typeof child === "number") return child;
      if (Array.isArray(child)) return recursivelyBuildChildren(child);
      if (isServerComponent(child.tag, child.props)) throw new Error("Cannot render server component on client");

      const children = new Set(child.props.children.concat(child.props.children));
      return React.createElement(
        child.tag,
        child.props,
        ...recursivelyBuildChildren(Array.from(children))
      );
    });
}

export function isServerComponent(tag: Tag, props: Props): tag is AsyncTag {
  if (!tag) return false;
  if (typeof tag === "string") return false;
  if (typeof tag !== "function") return false;
  return tag(props) instanceof Promise;
}

export function mergeProps(...props: Props[]) {
  return { ...props[0], ...props[1] }
}


export function isFragment(tag: Tag, props: Props): boolean {
  return tag === undefined && props.children && props.children.length > 0;
}

export function isPrimitive(component: Component): component is string | number {
  return typeof component === "string" || typeof component === "number";
}
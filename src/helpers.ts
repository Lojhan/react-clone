import React from "react";
import type {
  ErrorBoundaryComponent,
  Props,
  ReactComponent,
  SuspenseComponent,
  SuspenseResource,
  Tag,
} from "./types";

export function mergeProps(...props: Props[]) {
  return { ...props[0], ...props[1] };
}

export function isFragment(tag: Tag, props: Props): boolean {
  return tag === undefined && !!props?.children;
}

export function isPrimitive(component: unknown): component is string | number {
  return typeof component === "string" || typeof component === "number";
}
export function isContextProvider(component: ReactComponent): boolean {
  return component[React.Context];
}

export function isSuspenseComponent(
  component: ReactComponent,
): component is SuspenseComponent {
  return component[React.Suspense];
}

export function isErrorBoundaryComponent(
  component: ReactComponent,
): component is ErrorBoundaryComponent {
  return component[React.ErrorBoundary];
}

export function isPromise(value: unknown): value is Promise<unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof (value as Promise<unknown>).then === "function"
  );
}

export function isSuspenseResource(e: unknown): e is SuspenseResource {
  return !!(e && typeof e === "object" && "promise" in e);
}

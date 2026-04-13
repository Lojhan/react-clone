import React from "./React";
import type { Component, ErrorBoundaryFallback } from "./types";

type SuspenseProps = {
  children?: Component[];
  fallback: Component;
};

export function Suspense(props: SuspenseProps) {
  this[React.Suspense] = true;
  return <>{props.children}</>;
}

type ErrorBoundaryProps = {
  children?: Component[];
  fallback: ErrorBoundaryFallback;
};

export function ErrorBoundary(props: ErrorBoundaryProps) {
  this[React.ErrorBoundary] = true;
  return <>{props.children}</>;
}

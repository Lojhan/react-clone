import React from "./React";

export function Suspense(props) {
  this[React.Suspense] = true;
  return <>{props.children}</>;
}

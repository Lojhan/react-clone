
import { recursivelyBuildChildren } from "./helpers";

export function Suspense(props) {
  return recursivelyBuildChildren(props.children);
}

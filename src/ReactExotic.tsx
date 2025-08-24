import React from "./React";
import type { Component } from "./types";

type SuspenseProps = {
	children?: Component[];
	fallback: Component;
};

export function Suspense(props: SuspenseProps) {
	this[React.Suspense] = true;
	return <>{props.children}</>;
}

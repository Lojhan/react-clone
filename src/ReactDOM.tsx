import {
	isContextProvider,
	isFragment,
	isPrimitive,
	isSuspenseComponent,
} from "./helpers";
import React from "./React";
import type { Component, Props, SyncTag } from "./types";

type VNode = {
	type: string | ((props: unknown) => unknown) | symbol;
	props: Props;
	children?: VNode[];
	domElement?: HTMLElement | Text;
	key?: string | number;
	componentId?: string;
};

function ReactDOM() {
	let _root: Component;
	let _container: HTMLElement;
	let _currentTree: VNode | null = null;

	function renderRoot(root: Component, container: HTMLElement) {
		if (!root) throw new Error("No root component provided");

		_root = root;
		_container = container;

		React.startRender();
		const newTree = createVirtualTree(_root);

		if (newTree) {
			reconcile(newTree, _currentTree, container);
		}

		_currentTree = newTree;
		React.finishRender();
	}

	function rerender() {
		React.flushUpdate();
		renderRoot(_root, _container);
	}

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
				props: {},
				children: component
					.map((child) => createVirtualTree(child))
					.filter((e) => e !== null),
			};
		}

		if (isFragment(component.tag, component.props)) {
			return {
				type: React.Fragment,
				props: component.props,
				children: component.props.children
					.map((child) => createVirtualTree(child))
					.filter((e) => e !== null),
			};
		}

		if (isSuspenseComponent(component)) {
			const parentId = React.getCurrentNode().id;
			const componentId = React.generateComponentId(
				component.tag as SyncTag,
				component.props,
				parentId,
			);

			let cache = React.getSuspenseCache(componentId);
			if (!cache) {
				cache = React.createSuspenseCache(componentId);
			}

			React.enterComponent(componentId);

			let shouldShowFallback = false;
			let children = [];

			try {
				for (const child of component.props.children) {
					const childTree = createVirtualTree(child);
					if (childTree) {
						children.push(childTree);
					}
				}
			} catch (e) {
				if (e && typeof e === "object" && "promise" in e) {
					shouldShowFallback = true;
					children = [];
				} else {
					React.exitComponent();
					throw e;
				}
			}

			React.exitComponent();

			if (shouldShowFallback) {
				const fallbackTree = createVirtualTree(component.__suspense.fallback);
				return {
					type: React.Suspense,
					props: component.props,
					children: [fallbackTree],
					componentId,
				};
			}

			return {
				type: React.Suspense,
				props: component.props,
				children,
				componentId,
			};
		}

		if (typeof component.tag === "function") {
			const parentId = React.getCurrentNode().id;
			const componentId = React.generateComponentId(
				component.tag as SyncTag,
				component.props,
				parentId,
			);

			if (isContextProvider(component)) {
				React.enterComponent(componentId);
				const el = component.tag(component.props) as Component;
				const result = createVirtualTree(el);
				React.exitComponent();
				return {
					type: React.Context,
					props: component.props,
					children: [result],
					componentId,
				};
			}

			React.enterComponent(componentId);
			const el = component.tag(component.props) as Component;
			const result = createVirtualTree(el);
			React.exitComponent();
			return result
				? {
						...result,
						componentId,
					}
				: null;
		}

		return {
			type: component.tag,
			props: component.props,
			children: component.props.children
				.map((child) => createVirtualTree(child))
				.filter((e) => e !== null),
		};
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

		const maxLength = Math.max(newChildren.length, oldChildren.length);

		for (let i = 0; i < maxLength; i++) {
			const newChild = newChildren[i];
			const oldChild = oldChildren[i];

			reconcile(newChild || null, oldChild || null, container);
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
			if (name === "children") continue;
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
			type === React.Context
		);
	}

	return {
		renderRoot,
		rerender,
	};
}

export default ReactDOM();

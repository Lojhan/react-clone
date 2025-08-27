import ReactDOM from "./ReactDOM";
import { isPromise, mergeProps } from "./helpers";
import type { Component, Props, ReactElementTag, SyncTag } from "./types";

type HookNode = {
	id: string;
	hooks: unknown[];
	hookIndex: number;
	children: Map<string, HookNode>;
	parent?: HookNode;
	contexts: Map<symbol, unknown>;
	updateQueue: (() => void)[];
};

type SuspenseCache = Map<string, Promise<unknown> | unknown>;

export function React() {
	const rootNode: HookNode = createNode("root");
	const activeNodes = new Set<string>();
	let currentNode: HookNode = rootNode;
	enterComponent(rootNode.id);
	activeNodes.add(rootNode.id);
	const FragmentSymbol = Symbol.for("react.fragment");
	const ContextSymbol = Symbol.for("react.context");
	const SuspenseSymbol = Symbol.for("react.suspense");
	const suspenseCaches = new Map<string, SuspenseCache>();

	function getCurrentNode() {
		if (!currentNode) {
			throw new Error(
				"No current node found. Ensure you are inside a component.",
			);
		}

		return currentNode;
	}


	function getCurrentSuspenseBoundary(
		hookNode: HookNode,
	): SuspenseCache | undefined {
		let node = hookNode;

		while (node) {
			const cache = suspenseCaches.get(node.id);
			if (cache) {
				return cache;
			}
			node = node.parent;
		}

		console.error(
			"No suspense boundary found! Available caches:",
			Array.from(suspenseCaches.keys()),
		);
		throw new Error(
			"No Suspense boundary found when calling getCurrentSuspenseBoundary",
		);
	}

	function createSuspenseCache(componentId: string): SuspenseCache {
		const cache = new Map();
		suspenseCaches.set(componentId, cache);
		return cache;
	}

	function getSuspenseCache(componentId: string): SuspenseCache | undefined {
		return suspenseCaches.get(componentId);
	}

	function createNode(id: string, parent?: HookNode): HookNode {
		return {
			id,
			hooks: [],
			hookIndex: 0,
			parent,
			children: new Map(),
			contexts: new Map(),
			updateQueue: [],
		};
	}

	function enterComponent(componentId: string) {
		let childNode = currentNode.children.get(componentId);
		if (!childNode) {
			childNode = createNode(componentId, currentNode);
			currentNode.children.set(componentId, childNode);
		}

		currentNode = childNode;
		activeNodes.add(componentId);
		currentNode.hookIndex = 0;
	}

	function exitComponent() {
		if (!currentNode) return;

		const parentNode = currentNode.parent;

		if (parentNode) {
			currentNode = parentNode;
		}
	}

	function createElement(
		tag: string | ReactElementTag<Component>,
		props: Props = {},
		...children: Component[]
	): Component {
		const isFunc = typeof tag === "function";
		if (!isFunc) return createDomElement(tag, props, children);
		return createReactElement(tag, props, children);
	}

	function createDomElement(
		tag: string,
		props: Props,
		children: Component[],
	): Component {
		return {
			tag,
			props: mergeProps(props, { children }),
		};
	}

	function createReactElement(
		tag: ReactElementTag<Component>,
		props: Props,
		children: Component[],
	) {
		if (tag.name === "Suspense") {
			return createSuspenseElement(tag, props, children);
		}

		const isContextElement = tag[ContextSymbol];

		return {
			tag,
			[ContextSymbol]: isContextElement,
			props: mergeProps(props, { children }),
		};
	}

	function createSuspenseElement(
		tag: ReactElementTag<Component>,
		props: Props,
		children: Component[],
	) {
		const promiseCache = new Map();

		return {
			tag,
			[SuspenseSymbol]: true,
			props: mergeProps(props, { children }),
			__suspense: {
				id: currentNode.id,
				fallback: props.fallback,
				promiseCache,
			},
		};
	}

	function createResource<T>(promiseFn: () => Promise<T>, hookNode: HookNode) {
		const hookIndex = hookNode.hookIndex;
		const key = `${hookNode.id}:${hookIndex}`;

		const promiseCache = getCurrentSuspenseBoundary(hookNode);

		if (!promiseCache.has(key)) {
			const promise = promiseFn().then((data) => {
				promiseCache.set(key, data);
				ReactDOM.rerender();
				return data;
			});
			promiseCache.set(key, promise);
		}

		const value = promiseCache.get(key);
		if (isPromise(value)) {
			throw { promise: value, key };
		}

		return value as T;
	}

	function enqueueUpdate(
		update: (arg0: unknown) => void,
		index: number,
		hookNode: HookNode,
	) {
		if (!hookNode) {
			throw new Error("enqueueUpdate called outside of component context");
		}

		hookNode.updateQueue.push(() => {
			const componentId = hookNode?.id;
			if (hookNode && componentId) {
				const newState = update(hookNode.hooks[index]);
				hookNode.hooks[index] = newState;
			}
		});
	}

	function directUpdate(
		update: (arg0: unknown) => void,
		index: number,
		node: HookNode,
	) {
		if (!node) return;
		node.hooks[index] = update(node.hooks[index]);
	}

	function flushUpdate() {
		processNodeUpdates(rootNode);
		resetHookIndices(rootNode);
	}

	function startRender() {
		activeNodes.clear();
		activeNodes.add("root");
	}

	function finishRender() {
		cleanupUnusedNodes(rootNode);
	}

	function cleanupUnusedNodes(node: HookNode) {
		if (!node) return;

		const childrenToRemove = [];
		for (const [childId, childNode] of node.children) {
			if (!activeNodes.has(childId)) {
				childrenToRemove.push(childId);
				cleanupNodeSubtree(childNode);
			} else {
				cleanupUnusedNodes(childNode);
			}
		}

		for (const childId of childrenToRemove) {
			node.children.delete(childId);
		}
	}

	function cleanupNodeSubtree(node: HookNode) {
		if (!node) return;

		for (const [_, childNode] of node.children) {
			cleanupNodeSubtree(childNode);
		}

		node.children.clear();
		node.hooks = [];
		node.hookIndex = 0;
		node.updateQueue = [];
		node.contexts.clear();
	}

	function processNodeUpdates(node: HookNode | null) {
		if (!node) return;

		let update = node.updateQueue.pop();
		while (update) {
			update();
			update = node.updateQueue.pop();
		}

		for (const [_, child] of node.children) {
			processNodeUpdates(child);
		}
	}

	function resetHookIndices(node: HookNode | null) {
		if (!node) return;
		node.hookIndex = 0;
		for (const [_, child] of node.children) {
			resetHookIndices(child);
		}
	}

	function getHookIndex() {
		if (!currentNode) {
			throw new Error("getHookIndex called outside of component context");
		}
		const nextIndex = currentNode.hookIndex++;
		return nextIndex;
	}

	function getStateForIndex<T>(index: number) {
		if (!currentNode) {
			throw new Error("getStateForIndex called outside of component context");
		}
		return [currentNode.hooks[index] as T, currentNode] as const;
	}

	function setStateForIndex(
		index: number,
		newState: unknown,
		hookNode: HookNode,
	) {
		if (!hookNode) {
			throw new Error("setStateForIndex called outside of component context");
		}
		hookNode.hooks[index] = newState;
	}

	function setContextValue(contextId, value: unknown, hookNode: HookNode) {
		if (!hookNode) {
			throw new Error("setContextValue called outside of component context");
		}
		hookNode.contexts.set(contextId, value);
	}

	function getClosestContextValue<T>(
		contextId,
		defaultValue: T,
		hookNode: HookNode,
	): T {
		let node = hookNode;
		while (node) {
			if (node.contexts.has(contextId)) {
				return node.contexts.get(contextId) as T;
			}
			node = node.parent;
		}

		return defaultValue;
	}

	return {
		Fragment: FragmentSymbol,
		Suspense: SuspenseSymbol,
		Context: ContextSymbol,
		generateComponentId,
		mergeProps,
		createResource,
		createElement,
		getHookIndex,
		setStateForIndex,
		flushUpdate,
		enqueueUpdate,
		directUpdate,
		getStateForIndex,
		setContextValue,
		getClosestContextValue,
		getCurrentNode,
		enterComponent,
		exitComponent,
		startRender,
		finishRender,
		createSuspenseCache,
		getSuspenseCache,
	};
}

const react = React();
globalThis.React = react;
export default react;

export const {
	createElement,
	getHookIndex,
	setStateForIndex,
	flushUpdate,
	enqueueUpdate,
	directUpdate,
	getStateForIndex,
} = react;

export { Suspense } from "./ReactExotic";
export {
	createContext,
	use,
	useCallback,
	useContext,
	useEffect,
	useImperativeHandle,
	useMemo,
	useReducer,
	useRef,
	useState,
} from "./ReactHooks";

export function generateComponentId(
	tag: SyncTag,
	props: Props,
	parentId: string,
): string {
	const tagName = typeof tag === "function" ? tag.name || "Anonymous" : tag;
	const key = props.key;

	const tagIdentifier =
		typeof tag === "function" ? tag.toString().slice(0, 5) : tag;

	const result = [tagName, key, tagIdentifier]
		.filter(Boolean)
		.map((e) => e?.toString())
		.join("-");

	return hash(result);
}

function hash(str: string) {
	let hash = 0;
	if (str.length === 0) return hash.toString();

	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash = hash & hash;
	}

	return Math.abs(hash).toString(36);
}

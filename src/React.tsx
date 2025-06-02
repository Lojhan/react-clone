import ReactDOM from "./ReactDOM";
import { mergeProps, isPromise } from "./helpers";
import type { ReactComponent, Component, Props, SyncTag } from "./types";

type HookNode = {
	id: string;
	hooks: unknown[];
	hookIndex: number;
	children: Map<string, HookNode>;
	parent?: HookNode;
	contexts: Map<symbol, unknown>;
};

export function React() {
	let rootNode: HookNode | null = null;
	let currentNode: HookNode | null = null;
	const nodeStack: HookNode[] = [];
	const updateQueue = [];

	const memoCache = new Map<string, ReactComponent>();

	const suspenseMap: Map<
		string,
		Map<string | number, Promise<unknown> | unknown>
	> = new Map();
	function getCurrentSuspenseBoundary(_currentNode?: HookNode) {
		let __currentNode = _currentNode || currentNode;
		const item = suspenseMap.get(_currentNode?.id || "");

		if (item) {
			return item;
		}

		while (__currentNode) {
			const item = suspenseMap.get(__currentNode.id);
			if (item) {
				return item;
			}

			__currentNode = __currentNode.parent;
		}

		throw new Error(
			"No Suspense boundary found when calling getCurrentSuspenseBoundary",
		);
	}

	function createNode(id: string, parent?: HookNode): HookNode {
		return {
			id,
			hooks: [],
			hookIndex: 0,
			children: new Map(),
			parent,
			contexts: new Map(),
		};
	}

	function enterComponent(componentId: string) {
		if (!rootNode) {
			rootNode = createNode("root");
			currentNode = rootNode;
		}

		if (!currentNode) {
			throw new Error("Invalid component hierarchy");
		}

		let childNode = currentNode.children.get(componentId);
		if (!childNode) {
			childNode = createNode(componentId, currentNode);
			currentNode.children.set(componentId, childNode);
		}

		nodeStack.push(currentNode);
		currentNode = childNode;
		currentNode.hookIndex = 0;
	}

	function exitComponent() {
		const parentNode = nodeStack.pop();
		if (parentNode) {
			currentNode = parentNode;
		}
	}

	function createElement(
		tag: string | ((props: Props, children: Component[]) => Component),
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
		tag: (props: Props, children: Component[]) => Component,
		props: Props,
		children: Component[],
	): Component {
		const componentId = generateComponentId(tag, props);
		enterComponent(componentId);

		if (tag.name === "Suspense") {
			return createSuspenseElement(tag, props, children);
		}

		const hooksHash = currentNode
			? hash(safeStringify(currentNode.hooks))
			: "0";
		const memoKey = `${componentId}_${hooksHash}`;

		let result = memoCache.get(memoKey);
		if (!result) {
			result = {
				tag,
				props: mergeProps(props, { children }),
			};
			memoCache.set(memoKey, result);
		}

		exitComponent();
		return result;
	}

	function createSuspenseElement(
		tag: (props: Props, children: Component[]) => Component,
		props: Props,
		children: Component[],
	) {
		const suspenseId = generateComponentId(tag, props);
		const promiseCache = new Map();

		if (!suspenseMap.has(suspenseId)) {
			suspenseMap.set(suspenseId, promiseCache);
		}

		return {
			tag,
			props: mergeProps(props, { children }),
			__suspense: {
				id: suspenseId,
				fallback: props.fallback,
				promiseCache,
			},
		};
	}

	function createResource<T>(
		promiseFn: () => Promise<T>,
		key: string | number,
	) {
		const promiseCache = getCurrentSuspenseBoundary(currentNode);

		if (!promiseCache.has(key)) {
			promiseCache.set(
				key,
				new Promise((resolve, reject) => {
					promiseFn()
						.then((data) => {
							promiseCache.set(key, data);
							ReactDOM.rerender();
							resolve(data);
						})
						.catch(reject);
				}),
			);
		}

		const value = promiseCache.get(key);
		if (isPromise(value)) {
			throw { promise: value, key };
		}

		return value;
	}

	function enqueueUpdate(update: (arg0: unknown) => void, index: number) {
		updateQueue.push(() => {
			if (currentNode) {
				const componentId = currentNode.id;
				const newState = update(currentNode.hooks[index]);
				currentNode.hooks[index] = newState;
				memoCache.delete(
					`${componentId}_${hash(safeStringify(currentNode.hooks))}`,
				);
			}
		});
	}

	function directUpdate(update: (arg0: unknown) => void, index: number) {
		if (currentNode) {
			const newState = update(currentNode.hooks[index]);
			currentNode.hooks[index] = newState;
		}
	}

	function flushUpdate() {
		let update: () => void;
		update = updateQueue.shift();
		while (update) {
			update();
			update = updateQueue.shift();
		}

		resetHookIndices(rootNode);
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
		return currentNode.hooks[index] as T;
	}

	function setStateForIndex(index: number, newState: unknown) {
		if (!currentNode) {
			throw new Error("setStateForIndex called outside of component context");
		}
		currentNode.hooks[index] = newState;
	}

	function setContextValue(contextId: symbol, value: unknown) {
		if (!currentNode) {
			throw new Error("setContextValue called outside of component context");
		}
		currentNode.contexts.set(contextId, value);
	}

	function getClosestContextValue<T>(contextId: symbol, defaultValue: T): T {
		let node = currentNode;
		while (node) {
			if (node.contexts.has(contextId)) {
				return node.contexts.get(contextId) as T;
			}
			node = node.parent;
		}

		return defaultValue;
	}

	return {
		Fragment: Symbol.for("react.fragment"),
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
	};
}

const react = React();
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

export {
	useEffect,
	useRef,
	useState,
	use,
	useImperativeHandle,
	useContext,
	createContext,
} from "./ReactHooks";
export { Suspense } from "./ReactExotic";

export function generateComponentId(tag: SyncTag, props: Props): string {
	const tagName = typeof tag === "function" ? tag.name || "Anonymous" : tag;
	const key = props.key || hash(safeStringify(props));
	return `${tagName}_${key}`;
}

function hash(str: string) {
	return str.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
}

function safeStringify(obj: unknown) {
	const seen = new WeakSet();
	return JSON.stringify(
		obj,
		(_, value) => {
			if (typeof value === "object" && value !== null) {
				if (seen.has(value)) return;
				seen.add(value);
			}
			return value;
		},
		2,
	);
}

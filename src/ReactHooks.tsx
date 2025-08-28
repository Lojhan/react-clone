import React from "./React";
import ReactDOM from "./ReactDOM";
import type { Children, Component } from "./types";

type Factory<T> = () => T;
type State<T> = T | Factory<T>;
type UpdateFunction<T> = (prevState: T) => T;
type Callback = () => undefined | (() => void);
type Dependencies = unknown[];
type ResourceFactory<T> = () => Promise<T>;

type UseState<T> = readonly [T, (newState: T | UpdateFunction<T>) => void];
export function useState<T>(initialState: State<T>): UseState<T> {
	const hookIndex = React.getHookIndex();
	let [state, hookNode] = React.getStateForIndex<T>(hookIndex);

	if (state === undefined) {
		if (typeof initialState === "function") {
			state = (initialState as Factory<T>)();
		} else {
			state = initialState;
		}

		React.setStateForIndex(hookIndex, state, hookNode);
	}

	function setState(newState: T | UpdateFunction<T>) {
		if (typeof newState === "function") {
			React.enqueueUpdate(newState as UpdateFunction<T>, hookIndex, hookNode);
		} else {
			React.enqueueUpdate(() => newState, hookIndex, hookNode);
		}

		ReactDOM.rerender();
	}

	return [state, setState];
}

type UseEffectState = [Dependencies, ReturnType<Callback> | undefined];
export function useEffect(callback: Callback, dependencies: Dependencies) {
	const hookIndex = React.getHookIndex();
	const [prevState, hookNode] = React.getStateForIndex<UseEffectState>(
		hookIndex,
	) || [[], undefined];

	const [prevDependencies, prevCleanupFunction] = prevState || [];
	if (dependenciesChanged(prevDependencies, dependencies)) {
		if (prevCleanupFunction) {
			prevCleanupFunction();
		}

		const newCleanupFunction = callback();
		React.setStateForIndex(
			hookIndex,
			[dependencies, newCleanupFunction],
			hookNode,
		);
	}
}

function dependenciesChanged(prev: Dependencies, current: Dependencies) {
	if (!prev || prev.length !== current.length) return true;
	if (prev.length === 0 && current.length === 0) return false;

	return !current.every((dependency, index) => dependency === prev[index]);
}

type Ref<T> = { current: T | null };
export function useRef<T>(initialValue: T) {
	const hookIndex = React.getHookIndex();
	let [ref, hookNode] = React.getStateForIndex(hookIndex);

	if (ref === undefined) {
		ref = { current: initialValue };
		React.setStateForIndex(hookIndex, ref, hookNode);
	}

	return ref as Ref<T>;
}

export function use<T>(resource: Context<T> | ResourceFactory<T>): T {
	if ("_contextId" in resource) {
		return useContext(resource as Context<T>);
	}

	const hookNode = React.getCurrentNode();
	return React.createResource(resource as ResourceFactory<T>, hookNode);
}

export function useReducer<T, A>(
	reducer: (state: T, action: A) => T,
	initialState: T,
): [T, (action: A) => void] {
	const hookIndex = React.getHookIndex();
	let [state, hookNode] = React.getStateForIndex<T>(hookIndex);

	if (state === undefined) {
		state = initialState;
		React.setStateForIndex(hookIndex, state, hookNode);
	}

	function dispatch(action: A) {
		React.enqueueUpdate(
			(currentState: T) => reducer(currentState, action),
			hookIndex,
			hookNode,
		);
		ReactDOM.rerender();
	}

	return [state, dispatch];
}

export function useMemo<T>(factory: () => T, dependencies: Dependencies): T {
	const hookIndex = React.getHookIndex();
	const [prevState, hookNode] =
		React.getStateForIndex<[Dependencies, T]>(hookIndex);

	const [prevDependencies, memoizedValue] = prevState || [[], factory()];
	if (dependenciesChanged(prevDependencies, dependencies)) {
		const value = factory();
		React.setStateForIndex(hookIndex, [dependencies, value], hookNode);
		return value;
	}

	return memoizedValue;
}

// biome-ignore lint/suspicious/noExplicitAny: needed for generic callback
export function useCallback<T extends (...args: any[]) => any>(
	callback: T,
	dependencies: Dependencies,
): T {
	return useMemo(() => callback, dependencies);
}

type InternalContext<T> = {
	_contextId: symbol;
	_currentValue: T;
	Provider: (props: { children?: Children; value: T }) => Component;
};

type Context<T> = Pick<InternalContext<T>, "Provider">;

export function createContext<T>(defaultValue: T) {
	const contextId = Symbol("context-state");

	function Provider(props: { children?: Children; value: T }) {
		this[React.Context] = true;
		const hookNode = React.getCurrentNode();
		React.setContextValue(contextId, props.value ?? defaultValue, hookNode);
		return <>{props.children}</>;
	}

	Provider[React.Context] = true;
	return {
		_contextId: contextId,
		_currentValue: defaultValue,
		Provider,
	} as Context<T>;
}

export function useContext<T>(context: Context<T>): T {
	const hookNode = React.getCurrentNode();
	return React.getClosestContextValue<T>(
		(context as InternalContext<T>)._contextId,
		(context as InternalContext<T>)._currentValue,
		hookNode,
	);
}

export function useImperativeHandle<T>(
	ref: Ref<T>,
	createHandle: () => T,
	dependencies?: Dependencies,
) {
	const hookIndex = React.getHookIndex();
	const [prevDependencies, hookNode] =
		React.getStateForIndex<Dependencies>(hookIndex);

	if (dependenciesChanged(prevDependencies, dependencies)) {
		React.setStateForIndex(hookIndex, dependencies, hookNode);
		ref.current = createHandle();
	}
}

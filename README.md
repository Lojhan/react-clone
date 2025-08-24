A lightweight implementation of React core functionality built in TypeScript. This project is a custom React clone that recreates many of React's core features including components, hooks, context, and server-side rendering.

## Features

- **Core React API:** Implementation of React's fundamental rendering system
- **Hooks System:** Support for useState, useEffect, useRef, useContext, useReducer, and custom hooks
- **Context API:** Full implementation of React's Context system
- **Suspense & Lazy Loading:** Support for asynchronous components with Suspense
- **Key-Based Reconciliation:** Efficient updates using key props

## How Hooks State Works

The hooks system in this implementation is based on a tree structure of "hook nodes" that maintains component state:

1. **Component Tree Mapping:** Each component in the React tree has a corresponding hook node that stores its state.

2. **Hook Indexing:** Hooks are stored in an array within each component's hook node and are accessed by numerical index, which is why hooks cannot be used conditionally.

3. **State Persistence:** When a component renders:

   - The system tracks the current hook node ( `currentNode` )
   - Each hook call increments a counter ( `hookIndex` )
   - State is retrieved or initialized at the current index

4. **Update Mechanism:**
   - State updates are queued in an `updateQueue` array within the hook node
   - The `flushUpdate` function processes all queued updates throughout the component tree
   - After processing updates, the system resets hook indices and triggers a re-render

```typescript
// Hook state storage example (from ReactHooks.tsx)
export function useState<T>(
  initialState: State<T>
): readonly [T, (newState: T | ((prevState: T) => T)) => void] {
  const hookIndex = React.getHookIndex();
  let [state, hookNode] = React.getStateForIndex<T>(hookIndex);

  if (state === undefined) {
    if (typeof initialState === "function") {
      state = (initialState as () => T)();
    } else {
      state = initialState as T;
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
```

## How Reconciliation Works

Reconciliation is the process of updating the DOM efficiently when component state changes:

1. **Virtual DOM:** The system maintains a virtual representation of the DOM called the "virtual tree" (VNode structure in ReactDOM.tsx).

2. **Tree Comparison:** When a component updates, a new virtual tree is created and compared with the previous tree.

3. **Differential Updates:** The reconciliation process:

   - Reuses DOM nodes when element types match
   - Creates new nodes when element types change
   - Processes children with a key-based algorithm for efficient list updates

4. **Key-Based Updates:** When rendering lists, keys help the reconciler identify which items have been added, removed, or reordered, minimizing DOM operations.

5. **Component Lifecycle:** The system tracks which components are "active" during rendering and automatically cleans up unused components.

```typescript
// Reconciliation function (from ReactDOM.tsx)
function reconcile(
  newNode: VNode | null,
  oldNode: VNode | null,
  container: HTMLElement
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
          : container
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
  container: HTMLElement
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
```

## How Suspense Works

Suspense enables components to "wait" for asynchronous operations before rendering:

1. **Promise Tracking:** The Suspense system maintains caches of promises and their resolved values.

2. **Boundary Detection:** When a component suspends (throws a promise):

   - The system catches the promise at the nearest Suspense boundary
   - The fallback UI is shown while the promise resolves

3. **Resource Resolution:** The `use` hook (or `createResource` function) is the primary mechanism for Suspense:

   - It checks if the requested resource exists in the cache
   - If not, it starts fetching and throws the promise
   - If the resource is resolved, it returns the data

4. **Rendering Resumption:** When a promise resolves:
   - The resolved value is stored in the cache
   - A re-render is triggered
   - The component that suspended now receives the resolved data

```typescript
// Suspense mechanism (from React.tsx)
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
```

## Project Structure

```
react-clone/
├── src/
│   ├── React.tsx          # Core React implementation
│   ├── ReactDOM.tsx       # DOM rendering implementation
│   ├── ReactHooks.tsx     # Hook implementations
│   ├── helpers.ts         # Utility functions
│   ├── types.ts           # TypeScript type definitions
└── examples/
    ├── KeyExample.tsx
    ├── UseEffectExample.tsx
    ├── ContextComponentExample.tsx
    ├── LazyComponentExample.tsx
    └── UseImperativeHandlerExample.tsx
    ...
```

## Getting Started

1. Clone the repository:

```bash
git clone https://github.com/Lojhan/react-clone.git
cd react-clone
```

2. Install dependencies:

```bash
npm install
```

3. Run an example:

```bash
npm run dev
```

## Limitations

This is an educational implementation and not intended for production use. Some advanced React features may be missing or implemented differently than the original React library.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

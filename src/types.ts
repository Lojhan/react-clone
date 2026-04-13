export type Component = string | number | ReactComponent;
export type Children = Component[];
// biome-ignore lint/suspicious/noExplicitAny: needed for generic props
export type Props = Record<string, any> & { children?: Children };

export type ReactElementTag<T> = (props: Props, children?: Children) => T;
export type SyncTag = string | ReactElementTag<Component>;
export type AsyncTag = ReactElementTag<Promise<Component>>;
export type Tag = SyncTag | AsyncTag;

export type ReactComponent = {
  tag: Tag;
  props: Props;
  children?: Children;
};

export type Lane = "sync" | "default" | "transition";

export type HookUpdate = {
  hookIndex: number;
  lane: Lane;
  apply: (prevState: unknown) => unknown;
};

export type PassiveEffectRecord = {
  nodeId: string;
  hookIndex: number;
  dependencies: unknown[];
  create: () => undefined | (() => void);
};

export type ContextProviderMetadata<T = unknown> = {
  contextId: symbol;
  defaultValue: T;
};

export type SuspenseCacheRecord<T = unknown> =
  | {
      status: "pending";
      promise: Promise<T>;
    }
  | {
      status: "resolved";
      value: T;
    }
  | {
      status: "rejected";
      error: unknown;
    };

export type SuspenseResource = {
  promise: Promise<unknown>;
  key: string;
};

export type ErrorBoundaryFallback = Component | ((error: unknown) => Component);

export type SuspenseComponent = ReactComponent & {
  __suspense?: {
    id: string;
    fallback: Component;
  };
};

export type ErrorBoundaryComponent = ReactComponent & {
  __errorBoundary?: {
    fallback: ErrorBoundaryFallback;
  };
};

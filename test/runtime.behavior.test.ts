import { afterEach, beforeEach, describe, it, strict } from "poku";
import React, {
  ErrorBoundary,
  Suspense,
  act,
  createContext,
  useTransition,
  use,
  useContext,
  useEffect,
  useState,
} from "../src/React";
import ReactDOM from "../src/ReactDOM";
import { createDomEnvironment } from "./helpers/dom";

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

const h = React.createElement;

let environment: ReturnType<typeof createDomEnvironment>;

beforeEach(() => {
  environment = createDomEnvironment();
});

afterEach(async () => {
  await act(async () => {});
  environment.cleanup();
});

run().catch((error) => {
  throw error;
});

async function run() {
  await describe("react clone runtime", async () => {
    await it("batches multiple updates within a single act scope", async () => {
      let renders = 0;

      function Counter() {
        const [count, setCount] = useState(0);
        renders += 1;

        return h(
          "button",
          {
            id: "counter",
            onClick: () => {
              setCount((value) => value + 1);
              setCount((value) => value + 1);
            },
          },
          String(count),
        );
      }

      ReactDOM.renderRoot(
        h(Counter, { key: "batch-test" }),
        environment.container,
      );

      const button = environment.container.querySelector(
        "#counter",
      ) as HTMLButtonElement;
      await act(async () => {
        button.click();
      });

      strict.strictEqual(button.textContent, "2");
      strict.strictEqual(renders, 2);
    });

    await it("flushes passive effects after commit and cleans up before the next effect", async () => {
      const lifecycle: string[] = [];

      function EffectProbe() {
        const [count, setCount] = useState(0);

        useEffect(() => {
          lifecycle.push(`effect:${count}`);
          return () => {
            lifecycle.push(`cleanup:${count}`);
          };
        }, [count]);

        return h(
          "button",
          {
            id: "effect-probe",
            onClick: () => setCount((value) => value + 1),
          },
          String(count),
        );
      }

      ReactDOM.renderRoot(
        h(EffectProbe, { key: "effect-test" }),
        environment.container,
      );
      strict.deepStrictEqual(lifecycle, []);

      await act(async () => {});
      strict.deepStrictEqual(lifecycle, ["effect:0"]);

      const button = environment.container.querySelector(
        "#effect-probe",
      ) as HTMLButtonElement;
      await act(async () => {
        button.click();
      });

      strict.deepStrictEqual(lifecycle, ["effect:0", "cleanup:0", "effect:1"]);
    });

    await it("scopes context values to the nearest provider without leaking to siblings", async () => {
      const MessageContext = createContext("default");

      function Reader(props: { id: string }) {
        const value = useContext(MessageContext);
        return h("span", { id: props.id }, value);
      }

      function App() {
        return h(
          "div",
          {},
          h(
            MessageContext.Provider,
            { value: "outer" },
            h(Reader, { id: "outer-reader" }),
            h(
              MessageContext.Provider,
              { value: "inner" },
              h(Reader, { id: "inner-reader" }),
            ),
            h(Reader, { id: "outer-tail" }),
          ),
          h(Reader, { id: "default-reader" }),
        );
      }

      ReactDOM.renderRoot(
        h(App, { key: "context-test" }),
        environment.container,
      );
      await act(async () => {});

      strict.strictEqual(
        environment.container.querySelector("#outer-reader")?.textContent,
        "outer",
      );
      strict.strictEqual(
        environment.container.querySelector("#inner-reader")?.textContent,
        "inner",
      );
      strict.strictEqual(
        environment.container.querySelector("#outer-tail")?.textContent,
        "outer",
      );
      strict.strictEqual(
        environment.container.querySelector("#default-reader")?.textContent,
        "default",
      );
    });

    await it("keeps transition work pending until the transition lane commits", async () => {
      const renderLog: string[] = [];

      function TransitionProbe() {
        const [label, setLabel] = useState("idle");
        const [isPending, start] = useTransition();
        renderLog.push(`${label}:${isPending ? "pending" : "settled"}`);

        return h(
          "button",
          {
            id: "transition-probe",
            onClick: () => {
              start(() => {
                setLabel("transition-done");
              });
            },
          },
          `${label}:${isPending ? "pending" : "settled"}`,
        );
      }

      ReactDOM.renderRoot(
        h(TransitionProbe, { key: "transition-test" }),
        environment.container,
      );

      const button = environment.container.querySelector(
        "#transition-probe",
      ) as HTMLButtonElement;
      await act(async () => {});
      button.click();
      await act(async () => {});

      strict.ok(renderLog.includes("idle:pending"));
      strict.strictEqual(button.textContent, "transition-done:settled");
    });

    await it("renders suspense fallback first and retries with resolved content", async () => {
      const resource = createDeferred<string>();

      function AsyncText() {
        const value = use(() => resource.promise);
        return h("span", { id: "resolved" }, value);
      }

      function App() {
        return h(
          Suspense,
          { fallback: h("span", { id: "fallback" }, "loading") },
          h(AsyncText, {}),
        );
      }

      ReactDOM.renderRoot(
        h(App, { key: "suspense-test" }),
        environment.container,
      );

      strict.strictEqual(
        environment.container.querySelector("#fallback")?.textContent,
        "loading",
      );

      await act(async () => {
        resource.resolve("ready");
        await resource.promise;
      });

      strict.strictEqual(
        environment.container.querySelector("#resolved")?.textContent,
        "ready",
      );
      strict.strictEqual(
        environment.container.querySelector("#fallback"),
        null,
      );
    });

    await it("renders an error boundary fallback when async work rejects after suspense", async () => {
      const resource = createDeferred<string>();
      const settled = resource.promise.catch(() => undefined);

      function AsyncText() {
        const value = use(() => resource.promise);
        return h("span", { id: "resolved" }, value);
      }

      function App() {
        return h(
          ErrorBoundary,
          {
            fallback: (error: Error) =>
              h("span", { id: "error-fallback" }, error.message),
          },
          h(
            Suspense,
            { fallback: h("span", { id: "fallback" }, "loading") },
            h(AsyncText, {}),
          ),
        );
      }

      ReactDOM.renderRoot(
        h(App, { key: "rejected-suspense-test" }),
        environment.container,
      );
      strict.strictEqual(
        environment.container.querySelector("#fallback")?.textContent,
        "loading",
      );

      await act(async () => {
        resource.reject(new Error("request failed"));
        await settled;
      });

      strict.strictEqual(
        environment.container.querySelector("#error-fallback")?.textContent,
        "request failed",
      );
      strict.strictEqual(
        environment.container.querySelector("#fallback"),
        null,
      );
    });
  });
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: Deferred<T>["resolve"];
  let reject!: Deferred<T>["reject"];
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return {
    promise,
    resolve,
    reject,
  };
}

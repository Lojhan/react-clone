import { JSDOM } from "jsdom";

type GlobalKey =
  | "window"
  | "document"
  | "HTMLElement"
  | "Text"
  | "Node"
  | "Event"
  | "MouseEvent"
  | "navigator";

type DomEnvironment = {
  window: Window;
  container: HTMLDivElement;
  cleanup: () => void;
};

export function createDomEnvironment(): DomEnvironment {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost/",
  });

  assignGlobal("window", dom.window);
  assignGlobal("document", dom.window.document);
  assignGlobal("HTMLElement", dom.window.HTMLElement);
  assignGlobal("Text", dom.window.Text);
  assignGlobal("Node", dom.window.Node);
  assignGlobal("Event", dom.window.Event);
  assignGlobal("MouseEvent", dom.window.MouseEvent);
  assignGlobal("navigator", dom.window.navigator);

  const container = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(container);

  return {
    window: dom.window as unknown as Window,
    container,
    cleanup() {
      container.remove();
      dom.window.close();
    },
  };
}

function assignGlobal(key: GlobalKey, value: unknown) {
  Object.defineProperty(globalThis, key, {
    configurable: true,
    writable: true,
    value,
  });
}

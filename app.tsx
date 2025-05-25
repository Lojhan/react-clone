
import { ContextExample } from "./examples/ContextComponentExample";
import { FunctionalComponentExample } from "./examples/FunctionalComponentExample";
import { LazyComponentExample } from "./examples/LazyComponentExample";
import { UseEffectExample } from "./examples/UseEffectExample";
import { ImperativeHandleExample } from "./examples/UseImperativeHandlerExample";
import { UseStateExample } from "./examples/UseStateExample";
import { KeyExample } from "./examples/KeyExample";
import React from "./src/React";

const examples = [
  { title: "useState Example", example: UseStateExample, href: "useState" },
  { title: "useEffect Example", example: UseEffectExample, href: "useEffect" },
  { title: "useImperativeHandle Example", example: ImperativeHandleExample, href: "useImperativeHandle" },
  { title: "Context Example", example: ContextExample, href: "context" },
  { title: "Functional Component Example", example: FunctionalComponentExample, href: "functionalComponent" },
  { title: "Key Example", example: KeyExample, href: "key" },
  { title: "Suspense and use Example", example: LazyComponentExample, href: "lazyComponent" }
]

export function App(props) {
  const href = window.location.href.split("#")[1];
  const example = examples.find(example => example.href === href) || examples[0];
  const Example = example.example;

  return (
    <div style="display: flex; flex-direction: column; gap: 2rem; padding: 2rem;">
      <h1>React Examples</h1>
      <nav>
        <ul
          style="display: flex; gap: 1rem; padding: 0; margin: 0;"
        >
          {examples.map(example => (
            <li
              style="cursor: pointer; color: blue; text-decoration: underline; list-style: none;"
              onClick={e => {
                e.preventDefault();
                window.location.href = `#${example.href}`;
                window.location.reload();
              }}
            >{example.title}
            </li>
          ))}
        </ul>
      </nav>


      <Example />
    </div >
  )
}

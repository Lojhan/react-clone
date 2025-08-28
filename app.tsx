import { ContextExample } from "./examples/ContextComponentExample";
import { LazyComponentExample } from "./examples/LazyComponentExample";
import { UseEffectExample } from "./examples/UseEffectExample";
import { ImperativeHandleExample } from "./examples/UseImperativeHandlerExample";
import { UseStateExample } from "./examples/UseStateExample";
import { KeyExample } from "./examples/KeyExample";
import { FullExample } from "./examples/FullExample";
import { useCallback, useState } from "react";

const examples = [
	{ title: "useState Example", component: UseStateExample, href: "useState" },
	{
		title: "useEffect Example",
		component: UseEffectExample,
		href: "useEffect",
	},
	{
		title: "useImperativeHandle Example",
		component: ImperativeHandleExample,
		href: "useImperativeHandle",
	},
	{ title: "Context Example", component: ContextExample, href: "context" },
	{ title: "Key Example", component: KeyExample, href: "key" },
	{
		title: "Suspense and use Example",
		component: LazyComponentExample,
		href: "lazyComponent",
	},
	{ title: "Full Example", component: FullExample, href: "fullExample" },
];

function getInitialExample() {
	const href = window.location.href.split("#")[1];
	return examples.find((example) => example.href === href) || examples[0];
}

export function App() {
	const [example, setExample] = useState(getInitialExample());
	const Example = example.component;

	const onClickExample = useCallback((e) => {
		const href = e.target.getAttribute("href");
		const newExample = examples.find((ex) => ex.href === href);
		setExample(newExample);
		window.location.href = `#${newExample.href}`;
	}, []);

	return (
		<div style={styles.container}>
			<h1>React Examples</h1>
			<nav>
				<ul style={styles.list}>
					{examples.map((example) => (
						<li
							onClick={onClickExample}
							onKeyDown={onClickExample}
							href={example.href}
							key={example.href}
						>
							{example.title}
						</li>
					))}
				</ul>
			</nav>

			<Example />
		</div>
	);
}

const styles = {
	container: {
		display: "flex",
		flexDirection: "column",
		gap: "2rem",
		padding: "2rem",
	},
	list: {
		display: "flex",
		gap: "1rem",
		padding: 0,
		margin: 0,
	},
} as const;

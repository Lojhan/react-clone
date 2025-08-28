import { Suspense, use } from "react";

type TODO = {
	userId: number;
	id: number;
	title: string;
	completed: boolean;
};

async function getTodos() {
	const url = "https://jsonplaceholder.typicode.com/todos";
	const res = await fetch(url);
	await new Promise((resolve) => setTimeout(resolve, 2000));
	return res.json() as Promise<TODO[]>;
}

function LazyComponent() {
	const data = use(getTodos);

	return (
		<ul style={styles.list}>
			{data.map((e) => (
				<li key={e.id} style={styles.listItem(e.completed)}>
					{e.title}
				</li>
			))}
		</ul>
	);
}

export function LazyComponentExample() {
	return (
		<div>
			<h1>Lazy Component Example</h1>
			<p>This component fetches data lazily using use() hook.</p>
			<Suspense fallback={<Loading />}>
				<h2>Todo List</h2>
				<LazyComponent />
			</Suspense>
		</div>
	);
}

function Loading() {
	return <div style={styles.loading}>Loading...</div>;
}

const styles = {
	list: {
		maxHeight: "400px",
		margin: "20px 0",
		padding: 0,
		listStyleType: "none",
		overflowY: "auto",
	},
	listItem: (completed: boolean) => ({
		display: "flex",
		justifyContent: "space-between",
		alignItems: "center",
		opacity: completed ? 0.5 : 1,
	}),
	loading: {
		fontStyle: "italic",
		color: "#888",
		display: "flex",
		justifyContent: "center",
		alignItems: "center",
		height: "100px",
	},
} as const;

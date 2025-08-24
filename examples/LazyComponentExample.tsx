import { use, Suspense } from "react";

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
		<ul
			style={{
				listStyle: "none",
				padding: 0,
				margin: 0,
				height: "400px",
				overflowY: "auto",
			}}
		>
			{data.map((e) => (
				<li
					key={e.id}
					style={{
						padding: "0.5rem",
						borderBottom: "1px solid #ccc",
					}}
				>
					{e.title} - {e.completed ? "Completed" : "Pending"}
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
	return (
		<div
			style={{
				fontStyle: "italic",
				color: "#888",
				display: "flex",
				justifyContent: "center",
				alignItems: "center",
				height: "100px",
			}}
		>
			Loading...
		</div>
	);
}

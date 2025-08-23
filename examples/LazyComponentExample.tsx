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
        maxHeight: "400px",
        overflowY: "auto",
      }}
    >
      {data.map((e) => (
        <li key={e.id} style="display: flex; gap: 1rem">
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
      <Suspense fallback={<div>Loading...</div>}>
        <h2>Todo List</h2>
        <LazyComponent />
      </Suspense>
    </div>
  );
}

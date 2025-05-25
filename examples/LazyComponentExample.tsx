import React, { use, Suspense } from "../src/React";

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
  return res.json();
}

function LazyComponent() {
  const data = use<TODO[]>(getTodos, "promise");

  return (
    <div>
      {data.map((e) => (
        <div key={e.id} style="display: flex; gap: 1rem">
          {e.title} - {e.completed ? "Completed" : "Pending"}
        </div>
      ))}
    </div>
  );
}

export function LazyComponentExample() {
  return (
    <div>
      <h1>Lazy Component Example</h1>
      <Suspense fallback={<div>Loading...</div>}>
        Todos:
        <LazyComponent />
      </Suspense>
    </div>
  );
}

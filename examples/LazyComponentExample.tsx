import React, { use, Suspense } from "../src/React";

type TODO = {
  userId: number;
  id: number;
  title: string;
  completed: boolean;
};

function LazyComponent() {
  const url = "https://jsonplaceholder.typicode.com/todos";
  const data = use<TODO[]>(() => {
    return new Promise((resolve) => {
      const res = fetch(url).then((res) => res.json());
      setTimeout(() => resolve(res), 2000);
    });
  }, "promise");

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

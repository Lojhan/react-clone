import http from "node:http";
import ReactDOM from "./ReactDOM";
import React from "./React";

type Todo = {
  id: number;
  title: string;
  completed: boolean;
};

async function App({ name }) {
  const url = "https://jsonplaceholder.typicode.com/todos";
  const todos: Todo[] = await fetch(url).then((res) => res.json());

  return (
    <html>
      <body>
        <header>
          <h1>Hello {name}!</h1>
          <p>This is a paragraph</p>
          {[1, 2, 3].map((e) => (
            <div key={e}>{e}</div>
          ))}
        </header>
        <main>
          <div id="sus">
            {todos.map((e) => (
              <div key={e.id} style="display: flex; gap: 1rem">
                {e.title} - {e.completed ? "Completed" : "Pending"}
              </div>
            ))}
          </div>
        </main>
      </body>
    </html>
  );
}

const server = http.createServer(async (req, res) => {
  const name = req.url.split("/")[1];
  if (name === "favicon.ico") return;
  const app = await ReactDOM.renderToHTMLString(<App name={name} />);
  res.writeHead(200, { "Content-Type": "text/html" });
  res.write(app);
  res.end();
});

server.listen(3000, () => {
  console.log("listening SSR on port 3000");
});

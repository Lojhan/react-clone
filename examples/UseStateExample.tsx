import React, { useState } from "../src/React";

export function UseStateExample() {
  const [text, setText] = useState("");
  console.log("Rendering UseStateExample");

  return (
    <div style="display: flex; flex-direction: column; gap: 2rem;">
      <div>
        <h1>useState Example</h1>
        <StatefulComponent depth={1} />
      </div>

      <div>
        <label>Text: </label>
        <input value={text} onChange={(e) => setText(e.target.value)} />
      </div>
    </div>
  );
}

const StatefulComponent = ({ depth }) => {
  const [state, setState] = useState(0);

  if (depth > 5) {
    return null;
  }

  return (
    <>
      <div
        style={{
          paddingLeft: `${depth * 20}px`,
          margin: "10px",
        }}
      >
        <p>State: {state.toString()}</p>
        <button onClick={() => setState(state + 1)}>Increment</button>
        <button onClick={() => setState(state - 1)}>Decrement</button>
      </div>
      <StatefulComponent depth={depth + 1} />
    </>
  );
};

import React, { useState } from "../src/React";

export function UseStateExample() {
  const [count, setCount] = useState(0);
  const [text, setText] = useState('');

  return (
    <div style="display: flex; flex-direction: column; gap: 2rem;">
      <div>
        <h1>useState Example</h1>
        <p>Count: {count.toString()}</p>
        <button onClick={() => setCount(count + 1)}>Increment</button>
        <button onClick={() => setCount(count - 1)}>Decrement</button>
      </div>

      <div>
        <label>Text: </label>
        <input value={text} onChange={e => setText(e.target.value)} />
      </div>
    </div>
  );
}

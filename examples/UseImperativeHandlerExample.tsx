import React, { useImperativeHandle, useRef } from "../src/React";

export function ImperativeHandleExample() {
  const ref = useRef(null);

  return (
    <div>
      <h1>useImperativeHandle</h1>
      <ExampleHandler ref={ref} />
      <button type="button" onClick={() => ref.current.triggerAlert()}>
        Click to Test
      </button>
    </div>
  );
}

function ExampleHandler({ ref }) {
  useImperativeHandle(ref, () => ({
    triggerAlert: () => alert("ImperativeHandleExample"),
  }));

  return (
    <div style="margin-block: 10px;">
      Click the button to test the useImperativeHandle
    </div>
  );
}

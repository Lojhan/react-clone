import { useImperativeHandle, useRef } from "react";

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
		<div style={styles}>Click the button to test the useImperativeHandle</div>
	);
}

const styles = {
	marginBlock: "10px",
};

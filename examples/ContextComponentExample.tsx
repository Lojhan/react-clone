import { createContext, useContext, useEffect, useState } from "react";
import { useMemo } from "../src/ReactHooks";
import type { Component } from "../src/types";

const buildMessage = () =>
	`Current time is ${new Date().toLocaleTimeString()}.`;

const ExampleContext = createContext({
	message: buildMessage(),
	sendMessage: (_: string) => void 0,
});

export function ContextExample() {
	return (
		<ExampleContextProvider>
			<div>
				<h1>Context Example</h1>
				<p>
					This example demonstrates how to use React Context to share state
					between components.
				</p>
				<p>Check the console for messages sent and received.</p>
			</div>
			<MessageSender />
			<MessageReceiver />
		</ExampleContextProvider>
	);
}

type ExampleContextProviderProps = {
	children?: Component[];
};

function ExampleContextProvider(props: ExampleContextProviderProps) {
	const [message, setMessage] = useState(buildMessage());

	const sendMessage = (msg: string) => {
		setMessage(msg);
	};

	const value = useMemo(
		() => ({ message, sendMessage }),
		[message, sendMessage],
	);

	return (
		<ExampleContext.Provider value={value}>
			{props.children}
		</ExampleContext.Provider>
	);
}

function MessageSender() {
	const { message, sendMessage } = useContext(ExampleContext);

	useEffect(() => {
		const timer = setInterval(() => {
			const message = buildMessage();
			sendMessage(message);
		}, 1000);

		return () => clearInterval(timer);
	}, []);

	return <div>Sent Message: {message}</div>;
}

function MessageReceiver() {
	const ctx = useContext(ExampleContext);
	return <div>Received Message: {ctx.message}</div>;
}

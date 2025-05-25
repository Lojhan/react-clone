import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from "../src/React";

const ExampleContext = createContext({
  time: 0,
});

function ExampleContextProvider(props) {
  const [time, setTime] = useState(Date.now());

  useEffect(() => {
    setInterval(() => {
      setTime(Date.now());
    }, 1000);
  }, []);

  return (
    <ExampleContext.Provider value={{ time }}>
      {props.children}
    </ExampleContext.Provider>
  );
}

function ExampleContextConsumer() {
  const context = useContext(ExampleContext);
  return <h1>Current time: {new Date(context.time).toLocaleTimeString()}</h1>;
}

export function ContextExample() {
  return (
    <ExampleContextProvider>
      <ExampleContextConsumer />
    </ExampleContextProvider>
  );
}

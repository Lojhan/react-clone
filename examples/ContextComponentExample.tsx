import React, { createContext, useContext, useEffect, useState } from "../src/React";

const ExampleContext = createContext({
  name: "default",
});

function ExampleContextProvider(props) {
  const [name, setName] = useState("test");

  useEffect(() => {
    setTimeout(() => {
      setName("new name");
    }, 2000);
  }, []);

  return (
    <ExampleContext.Provider value={{ name }}>
      {props.children}
    </ExampleContext.Provider>
  )
}

function ExampleContextConsumer() {
  const context = useContext(ExampleContext);
  return <h1>Name: {context.name}</h1>;
}


export function ContextExample() {
  return (
    <ExampleContextProvider>
      <ExampleContextConsumer />
    </ExampleContextProvider>
  );
};

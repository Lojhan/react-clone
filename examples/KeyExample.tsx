import { useState } from "react";

const initialItems = Array.from({ length: 5 }, (_, i) => ({
  id: i + 1,
  text: `Item ${i + 1}`,
}));

export function KeyExample() {
  const [items, setItems] = useState(initialItems);

  function addItem() {
    const newItem = { id: items.length + 1, text: `Item ${items.length + 1}` };
    setItems((prevItems) => [...prevItems, newItem]);
  }

  function removeItem(id: number) {
    setItems((prevItems) => prevItems.filter((item) => item.id !== id));
  }

  function reverseItems() {
    setItems((prevItems) => [...prevItems].reverse());
  }

  return (
    <div>
      <h1>Key Example</h1>
      <div style={styles.actions}>
        <button type="button" onClick={addItem}>
          Add Item
        </button>
        <button type="button" onClick={reverseItems}>
          Reverse Items
        </button>
      </div>
      <ul style={styles.list}>
        {items.map((item) => (
          <li key={item.id} style={styles.listItem}>
            {item.text}
            <button
              type="button"
              onClick={() => removeItem(item.id)}
              style={styles.removeButton}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

const styles = {
  actions: {
    display: "flex",
    gap: "12px",
  },
  list: {
    maxWidth: "300px",
    margin: "20px 0",
    padding: 0,
    listStyleType: "none",
  },
  listItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  removeButton: {
    background: "red",
    color: "white",
  },
} as const;

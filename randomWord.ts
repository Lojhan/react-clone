export function randomWord() {
  const words = [
    "apple", "banana", "cherry", "date", "fig",
    "grape", "kiwi", "lemon", "mango", "orange",
    "peach", "pear", "quince", "raspberry", "strawberry",
    "blueberry", "watermelon", "pineapple", "coconut", "avocado",
    "pomegranate", "plum", "apricot", "blackberry", "cranberry",
    "elderberry", "grapefruit", "guava", "lime"
  ];

  return words[Math.floor(Math.random() * words.length)];
}

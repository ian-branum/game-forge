import type { LogicPuzzle } from "@/lib/generators/puzzle";

export const puzzleDemo: LogicPuzzle = {
  title: "The Detective's Casebook",
  topic: "A classic whodunit logic puzzle",
  intro: "Four suspects were at the mansion the night of the theft. Deduce who stole what.",
  categories: [
    ["Colonel Wick", "Lady Frost", "Dr. Penn", "Miss Caine"],
    ["Library", "Kitchen", "Garden", "Study"],
    ["Candlestick", "Dagger", "Rope", "Wrench"],
  ],
  // solution[i][j]=1 means categories[0][i] matches categories[2][j]
  // Colonel Wick → Rope, Lady Frost → Dagger, Dr. Penn → Wrench, Miss Caine → Candlestick
  solution: [
    [0, 0, 1, 0],
    [0, 1, 0, 0],
    [0, 0, 0, 1],
    [1, 0, 0, 0],
  ],
  clues: [
    { text: "The person in the Library did not use the Candlestick." },
    { text: "Colonel Wick was found in the Garden." },
    { text: "Lady Frost was in the Library." },
    { text: "The Wrench was used by whoever was in the Study." },
    { text: "Miss Caine was not in the Kitchen." },
    { text: "The Dagger was not used in the Garden or the Study." },
  ],
};

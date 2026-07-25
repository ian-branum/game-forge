import type { WordPuzzle } from "@/lib/generators/word";

// Grid is 12×12. Words placed left-to-right or top-to-bottom.
export const wordDemo: WordPuzzle = {
  title: "Ocean Life Word Search",
  topic: "Marine animals and ocean features",
  words: ["SHARK", "CORAL", "WHALE", "KELP", "OCTOPUS", "DOLPHIN", "TRENCH", "REEF"],
  clues: [
    "Apex predator with rows of teeth",
    "Colorful reef-building organism",
    "Largest animal on Earth",
    "Giant underwater forest plant",
    "Eight-armed invertebrate",
    "Intelligent social cetacean",
    "Deepest part of the ocean floor",
    "Shallow underwater ecosystem",
  ],
  grid: [
    ["S","H","A","R","K","B","C","D","F","G","H","J"],
    ["K","O","C","T","O","P","U","S","B","C","D","F"],
    ["G","H","J","K","L","M","N","P","R","S","T","V"],
    ["W","H","A","L","E","B","C","D","F","G","H","J"],
    ["K","L","M","N","P","R","S","T","V","W","X","Z"],
    ["B","C","D","O","L","P","H","I","N","G","H","J"],
    ["K","L","M","F","P","R","S","T","V","W","X","Z"],
    ["C","O","R","A","L","B","C","D","F","G","H","J"],
    ["K","L","M","N","P","R","T","R","E","N","C","H"],
    ["B","C","D","F","G","H","J","K","L","M","N","P"],
    ["R","E","E","F","S","T","V","W","X","Z","B","C"],
    ["K","E","L","P","G","H","J","K","L","M","N","P"],
  ],
};

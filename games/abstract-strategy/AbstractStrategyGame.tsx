"use client";
import type { AbstractStrategyScenario } from "./schema";
import OthelloGame from "./games/OthelloGame";
import ChessGame from "./games/ChessGame";

export default function AbstractStrategyGame({ scenario }: { scenario: AbstractStrategyScenario }) {
  if (scenario.gameId === "othello") return <OthelloGame scenario={scenario} />;
  if (scenario.gameId === "chess")   return <ChessGame scenario={scenario} />;
  return <div>Unknown game: {scenario.gameId}</div>;
}

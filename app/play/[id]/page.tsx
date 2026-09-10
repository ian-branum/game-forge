import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { normandyScenario } from "@/lib/squad-leader/scenarios/normandy";
import { triviaDemo } from "@/lib/demos/trivia-demo";
import { narrativeDemo } from "@/lib/demos/narrative-demo";
import { wordDemo } from "@/games/word/demo";
import { puzzleDemo } from "@/games/puzzle/demo";
import { cardDemo } from "@/games/card/demo";
import TacticalGame from "@/components/TacticalGame";
import NarrativeGame from "@/components/NarrativeGame";
import OthelloGame from "@/components/OthelloGame";
import { getPlayerPlugin } from "@/games/player-registry";
import type { ScenarioDefinition } from "@/lib/squad-leader/types";
import type { TriviaScenario } from "@/lib/generators/trivia";
import type { NarrativeScenario } from "@/lib/generators/narrative";

export default async function PlayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (id === "normandy-demo") return <TacticalGame scenario={normandyScenario} />;
  if (id === "othello-demo")  return <OthelloGame />;

  if (id === "trivia-demo") {
    const plugin = getPlayerPlugin("trivia");
    if (!plugin) return notFound();
    const { Player } = plugin;
    return <Player scenario={triviaDemo} />;
  }

  if (id === "word-demo") {
    const plugin = getPlayerPlugin("word");
    if (!plugin) return notFound();
    const { Player } = plugin;
    return <Player scenario={wordDemo} />;
  }

  if (id === "puzzle-demo") {
    const plugin = getPlayerPlugin("puzzle");
    if (!plugin) return notFound();
    const { Player } = plugin;
    return <Player scenario={puzzleDemo} />;
  }

  if (id === "card-demo") {
    const plugin = getPlayerPlugin("card");
    if (!plugin) return notFound();
    const { Player } = plugin;
    return <Player scenario={cardDemo} />;
  }

  if (id === "narrative-demo") return <NarrativeGame scenario={narrativeDemo} />;

  const row = await prisma.scenario.findUnique({ where: { id } });
  if (!row) return notFound();

  // Try plugin registry first
  const plugin = getPlayerPlugin(row.category);
  if (plugin) {
    const { Player } = plugin;
    return <Player scenario={row.payload} />;
  }

  // Legacy fallback for non-migrated types
  switch (row.category) {
    case "tactical": {
      const scenario = row.payload as unknown as ScenarioDefinition;
      scenario.id = row.id;
      return <TacticalGame scenario={scenario} />;
    }
    case "narrative":
      return <NarrativeGame scenario={row.payload as unknown as NarrativeScenario} />;
    default:
      return notFound();
  }
}

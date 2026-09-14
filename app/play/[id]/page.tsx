import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { normandyScenario } from "@/games/tactical/engine/scenarios/normandy";
import { triviaDemo } from "@/games/trivia/demo";
import { narrativeDemo } from "@/games/narrative/demo";
import { wordDemo } from "@/games/word/demo";
import { puzzleDemo } from "@/games/puzzle/demo";
import { cardDemo } from "@/games/card/demo";
import OthelloGame from "@/components/OthelloGame";
import { getPlayerPlugin } from "@/games/player-registry";

export default async function PlayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (id === "normandy-demo") {
    const plugin = getPlayerPlugin("tactical");
    if (!plugin) return notFound();
    const { Player } = plugin;
    return <Player scenario={normandyScenario} />;
  }
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

  if (id === "narrative-demo") {
    const plugin = getPlayerPlugin("narrative");
    if (!plugin) return notFound();
    const { Player } = plugin;
    return <Player scenario={narrativeDemo} />;
  }

  const row = await prisma.scenario.findUnique({ where: { id } });
  if (!row) return notFound();

  // Try plugin registry first
  const plugin = getPlayerPlugin(row.category);
  if (plugin) {
    const { Player } = plugin;
    // For tactical, the stored payload may not have the DB id set
    const payload = row.category === "tactical"
      ? { ...(row.payload as object), id: row.id }
      : row.payload;
    return <Player scenario={payload} />;
  }

  return notFound();
}

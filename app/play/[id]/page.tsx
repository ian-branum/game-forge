import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { normandyScenario } from "@/lib/squad-leader/scenarios/normandy";
import TacticalGame from "@/components/TacticalGame";
import TriviaGame from "@/components/TriviaGame";
import WordGame from "@/components/WordGame";
import PuzzleGame from "@/components/PuzzleGame";
import CardGame from "@/components/CardGame";
import NarrativeGame from "@/components/NarrativeGame";
import OthelloGame from "@/components/OthelloGame";
import type { ScenarioDefinition } from "@/lib/squad-leader/types";
import type { TriviaScenario } from "@/lib/generators/trivia";
import type { WordPuzzle } from "@/lib/generators/word";
import type { LogicPuzzle } from "@/lib/generators/puzzle";
import type { SolitaireScenario } from "@/lib/generators/card";
import type { NarrativeScenario } from "@/lib/generators/narrative";

export default async function PlayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (id === "normandy-demo") return <TacticalGame scenario={normandyScenario} />;
  if (id === "othello-demo")  return <OthelloGame />;

  const row = await prisma.scenario.findUnique({ where: { id } });
  if (!row) return notFound();

  switch (row.category) {
    case "tactical": {
      const scenario = row.payload as unknown as ScenarioDefinition;
      scenario.id = row.id;
      return <TacticalGame scenario={scenario} />;
    }
    case "trivia":
      return <TriviaGame scenario={row.payload as unknown as TriviaScenario} />;
    case "word":
      return <WordGame scenario={row.payload as unknown as WordPuzzle} />;
    case "puzzle":
      return <PuzzleGame scenario={row.payload as unknown as LogicPuzzle} />;
    case "card":
      return <CardGame scenario={row.payload as unknown as SolitaireScenario} />;
    case "narrative":
      return <NarrativeGame scenario={row.payload as unknown as NarrativeScenario} />;
    default:
      return notFound();
  }
}

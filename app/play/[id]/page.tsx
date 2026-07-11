import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { normandyScenario } from "@/lib/squad-leader/scenarios/normandy";
import TacticalGame from "@/components/TacticalGame";
import type { ScenarioDefinition } from "@/lib/squad-leader/types";

export default async function PlayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let scenario: ScenarioDefinition;

  if (id === "normandy-demo") {
    scenario = normandyScenario;
  } else {
    const row = await prisma.scenario.findUnique({ where: { id } });
    if (!row || row.category !== "tactical") return notFound();
    scenario = row.payload as unknown as ScenarioDefinition;
    scenario.id = row.id;
  }

  return <TacticalGame scenario={scenario} />;
}

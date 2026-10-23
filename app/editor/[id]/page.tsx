import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ScenarioDefinitionSchema } from "@/games/tactical/schema";
import ScenarioEditor from "@/games/tactical/ScenarioEditor";

export const metadata = {
  title: "Scenario Editor · Game Forge",
};

export default async function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/editor/${id}`);
  }

  const row = await prisma.scenario.findUnique({ where: { id } });
  if (!row) notFound();

  // Only the owner can edit, and only tactical scenarios have this editor.
  if (row.userId !== session.user.id || row.category !== "tactical") {
    redirect(`/play/${id}`);
  }

  const parsed = ScenarioDefinitionSchema.safeParse({ ...(row.payload as object), id: row.id });
  if (!parsed.success) {
    // A malformed payload can't be edited meaningfully — fall back to playing it.
    redirect(`/play/${id}`);
  }

  return <ScenarioEditor scenarioId={row.id} initialScenario={parsed.data} />;
}

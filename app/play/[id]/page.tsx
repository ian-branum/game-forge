import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getPlayerPlugin } from "@/games/player-registry";
import TrialGate from "@/components/TrialGate";

export default async function PlayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const row = await prisma.scenario.findUnique({ where: { id } });
  if (!row) return notFound();

  const plugin = getPlayerPlugin(row.category);
  if (!plugin) return notFound();

  const { Player } = plugin;

  // Tactical scenarios need the DB id injected into the payload
  const payload = row.category === "tactical"
    ? { ...(row.payload as object), id: row.id }
    : row.payload;

  // The gate POSTs to /api/play/[id]/start on mount and renders the game only
  // once the server confirms the viewer is the owner, licensed, or within trial.
  // Demo games bypass the gate entirely — no auth, no trial counting, no blocks.
  return (
    <TrialGate
      scenarioId={row.id}
      title={row.title}
      priceToPlay={row.priceToPlay}
      priceToClone={row.priceToClone}
      category={row.category}
      isDemo={row.isDemo}>
      <Player scenario={payload} />
    </TrialGate>
  );
}

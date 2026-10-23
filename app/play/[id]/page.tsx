import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getPlayerPlugin } from "@/games/player-registry";
import TrialGate from "@/components/TrialGate";

export default async function PlayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const row = await prisma.scenario.findUnique({
    where: { id },
    include: { activeVersion: { select: { payload: true } } },
  });
  if (!row) return notFound();

  const plugin = getPlayerPlugin(row.category);
  if (!plugin) return notFound();

  const { Player } = plugin;

  // Use the active version's payload if one is set; otherwise fall back to the
  // original V1 payload stored directly on the scenario row.
  const activePayload = row.activeVersion?.payload ?? row.payload;

  // Tactical scenarios need the DB id injected into the payload
  const payload = row.category === "tactical"
    ? { ...(activePayload as object), id: row.id }
    : activePayload;

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

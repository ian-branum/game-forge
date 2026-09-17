import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getPlayerPlugin } from "@/games/player-registry";

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

  return <Player scenario={payload} />;
}

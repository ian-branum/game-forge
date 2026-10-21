import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// PATCH /api/scenarios/[id]/deep-archive
// One-way: permanently hides an already-archived game from every UI surface.
// The row is never deleted — this only flips flags, so it stays recoverable in
// the database if a mistake needs undoing by hand.
export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const scenario = await prisma.scenario.findUnique({
    where: { id },
    select: { userId: true, archived: true, deepArchived: true },
  });
  if (!scenario) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (scenario.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // No toggle and no un-deep-archive: the UI only offers this once the game is
  // already in the archive, and repeating the call is harmless.
  if (scenario.deepArchived) {
    return NextResponse.json({ ok: true });
  }

  await prisma.scenario.update({
    where: { id },
    data: { deepArchived: true, archived: true, isPublic: false },
  });

  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const ADVENTURE_SUBTYPES = ["fixed", "infinite", "mystery"];

// PATCH /api/scenarios/[id]/publish
// Owner-only. Publishes a game to the marketplace and stores its pricing/trial/clone config.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const scenario = await prisma.scenario.findUnique({ where: { id } });
  if (!scenario) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (scenario.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as
    | {
        isPublic?: unknown;
        isClonable?: unknown;
        clonesMayRepublish?: unknown;
        priceToPlay?: unknown;
        priceToClone?: unknown;
        freePlayLimit?: unknown;
        adventureSubtype?: unknown;
      }
    | null;
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const isPublic = typeof body.isPublic === "boolean" ? body.isPublic : scenario.isPublic;
  const isClonable = typeof body.isClonable === "boolean" ? body.isClonable : scenario.isClonable;
  const clonesMayRepublish = typeof body.clonesMayRepublish === "boolean" ? body.clonesMayRepublish : scenario.clonesMayRepublish;
  const priceToPlay = Number.isFinite(Number(body.priceToPlay)) ? Math.max(0, Math.floor(Number(body.priceToPlay))) : scenario.priceToPlay;
  const priceToClone = Number.isFinite(Number(body.priceToClone)) ? Math.max(0, Math.floor(Number(body.priceToClone))) : scenario.priceToClone;
  const freePlayLimit = Number.isFinite(Number(body.freePlayLimit)) ? Math.floor(Number(body.freePlayLimit)) : scenario.freePlayLimit;

  if (priceToClone < priceToPlay) {
    return NextResponse.json({ error: "Price to Clone must be greater than or equal to Price to Play." }, { status: 400 });
  }
  if (freePlayLimit < 1 || freePlayLimit > 3) {
    return NextResponse.json({ error: "Free trial must be 1 or 3 sessions." }, { status: 400 });
  }

  let adventureSubtype: string | null = scenario.adventureSubtype;
  if (scenario.category === "narrative") {
    const sub = typeof body.adventureSubtype === "string" ? body.adventureSubtype : scenario.adventureSubtype;
    if (!sub || !ADVENTURE_SUBTYPES.includes(sub)) {
      return NextResponse.json({ error: "Adventure type must be fixed, infinite or mystery." }, { status: 400 });
    }
    adventureSubtype = sub;
  }

  // Republish guard: a fork may only go public if the original's creator permits it.
  if (isPublic && scenario.parentScenarioId) {
    const parent = await prisma.scenario.findUnique({
      where: { id: scenario.parentScenarioId },
      select: { clonesMayRepublish: true },
    });
    if (parent && parent.clonesMayRepublish === false) {
      return NextResponse.json(
        { error: "The original creator has not permitted clones of this game to be published." },
        { status: 403 }
      );
    }
  }

  const updated = await prisma.scenario.update({
    where: { id },
    data: { isPublic, isClonable, clonesMayRepublish, priceToPlay, priceToClone, freePlayLimit, adventureSubtype },
    select: {
      id: true,
      isPublic: true,
      isClonable: true,
      clonesMayRepublish: true,
      priceToPlay: true,
      priceToClone: true,
      freePlayLimit: true,
      adventureSubtype: true,
    },
  });

  return NextResponse.json(updated);
}

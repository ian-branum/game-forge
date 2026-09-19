import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

// POST /api/marketplace/[id]/clone
// Clones a public game account-side: atomically grants a PLAY license on the
// original AND creates a private fork owned by the cloner.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const { id } = await params;

  const source = await prisma.scenario.findUnique({
    where: { id },
    include: { activeVersion: { select: { payload: true } } },
  });
  if (!source) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (source.userId === userId) {
    return NextResponse.json({ error: "You already own this game" }, { status: 400 });
  }
  if (!source.isClonable) {
    return NextResponse.json({ error: "This game is not available for cloning." }, { status: 403 });
  }

  if (source.priceToClone > 0) {
    const license = await prisma.scenarioLicense.findUnique({
      where: { userId_scenarioId_type: { userId, scenarioId: id, type: "CLONE" } },
    });
    if (!license) {
      return NextResponse.json({ error: "Clone license required", priceToClone: source.priceToClone }, { status: 402 });
    }
  }

  const payload = (source.activeVersion?.payload ?? source.payload) as Prisma.InputJsonValue;

  const created = await prisma.$transaction(async tx => {
    // 3a. Grant a PLAY license on the original (live access to the current version).
    await tx.scenarioLicense.upsert({
      where: { userId_scenarioId_type: { userId, scenarioId: id, type: "PLAY" } },
      create: { userId, scenarioId: id, type: "PLAY", amount: 0 },
      update: {},
    });

    // 3b. Create the private fork owned by the cloner.
    return tx.scenario.create({
      data: {
        userId,
        category: source.category,
        title: `${source.title} (cloned)`,
        prompt: source.prompt,
        payload,
        description: source.description,
        parentScenarioId: source.id,
        originalScenarioId: source.originalScenarioId ?? source.id,
        freePlayLimit: source.freePlayLimit,
        adventureSubtype: source.adventureSubtype,
        isPublic: false,
        isClonable: false,
        priceToPlay: 0,
        priceToClone: 0,
      },
    });
  });

  return NextResponse.json({ id: created.id });
}

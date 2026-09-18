import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// POST /api/play/[id]/start
// Enforces the free-trial gate server-side and increments the play counter.
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

  const scenario = await prisma.scenario.findUnique({
    where: { id },
    select: {
      userId: true,
      isDemo: true,
      freePlayLimit: true,
      priceToPlay: true,
      priceToClone: true,
      title: true,
    },
  });
  if (!scenario) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // The owner can always play their own game (and no tracking needed).
  if (scenario.userId === userId) {
    return NextResponse.json({ allowed: true, owner: true });
  }

  // Demos and licensed games bypass the trial limit.
  if (scenario.isDemo) {
    return NextResponse.json({ allowed: true });
  }
  const license = await prisma.scenarioLicense.findFirst({
    where: { userId, scenarioId: id, type: { in: ["PLAY", "CLONE"] } },
  });
  if (license) {
    return NextResponse.json({ allowed: true, licensed: true });
  }

  const play = await prisma.scenarioPlay.findUnique({
    where: { userId_scenarioId: { userId, scenarioId: id } },
  });
  const trialCount = play?.count ?? 0;

  if (trialCount >= scenario.freePlayLimit) {
    return NextResponse.json(
      {
        trialExhausted: true,
        priceToPlay: scenario.priceToPlay,
        priceToClone: scenario.priceToClone,
        freePlayLimit: scenario.freePlayLimit,
        title: scenario.title,
      },
      { status: 402 }
    );
  }

  const updated = await prisma.scenarioPlay.upsert({
    where: { userId_scenarioId: { userId, scenarioId: id } },
    create: { userId, scenarioId: id, count: 1 },
    update: { count: { increment: 1 } },
  });

  return NextResponse.json({
    allowed: true,
    trialCount: updated.count,
    freePlayLimit: scenario.freePlayLimit,
  });
}

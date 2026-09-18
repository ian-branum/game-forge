import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const buyerId = session.user.id;
  const { id } = await params;

  const body = (await req.json().catch(() => null)) as { type?: unknown } | null;
  const type = body?.type;
  if (type !== "PLAY" && type !== "CLONE") {
    return NextResponse.json({ error: "type must be PLAY or CLONE" }, { status: 400 });
  }

  const scenario = await prisma.scenario.findUnique({ where: { id } });
  if (!scenario) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!scenario.isPublic) return NextResponse.json({ error: "Not for sale" }, { status: 400 });
  if (scenario.userId === buyerId) {
    return NextResponse.json({ error: "You already own this game" }, { status: 400 });
  }

  const price = type === "PLAY" ? scenario.priceToPlay : scenario.priceToClone;

  const existing = await prisma.scenarioLicense.findUnique({
    where: { userId_scenarioId_type: { userId: buyerId, scenarioId: id, type } },
  });
  if (existing) {
    return NextResponse.json({ error: `You already own the ${type} license` }, { status: 409 });
  }

  const buyer = await prisma.user.findUnique({ where: { id: buyerId } });
  if (!buyer || buyer.credits < price) {
    return NextResponse.json({ error: "Insufficient credits", needed: price, have: buyer?.credits ?? 0 }, { status: 402 });
  }

  const sellerId = scenario.userId;

  await prisma.$transaction([
    prisma.user.update({ where: { id: buyerId }, data: { credits: { decrement: price } } }),
    prisma.user.update({ where: { id: sellerId }, data: { credits: { increment: price } } }),
    prisma.scenarioLicense.create({
      data: { userId: buyerId, scenarioId: id, type, amount: price },
    }),
    prisma.creditTransaction.create({
      data: { userId: buyerId, amount: -price, reason: type === "PLAY" ? "play_purchase" : "clone_purchase" },
    }),
    prisma.creditTransaction.create({
      data: { userId: sellerId, amount: price, reason: "sale" },
    }),
  ]);

  return NextResponse.json({ success: true, type });
}

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

  const listedPrice = type === "PLAY" ? scenario.priceToPlay : scenario.priceToClone;

  // Platform tax: clone always costs at least 1 credit (platform keeps the
  // difference). Play purchases have no minimum — free play stays free.
  const CLONE_TAX = 1;
  const buyerPays  = type === "CLONE" ? Math.max(listedPrice, CLONE_TAX) : listedPrice;
  const sellerGets = listedPrice; // seller always receives what they listed
  const platformGets = buyerPays - sellerGets; // 0 for play, ≥1 for clone

  const existing = await prisma.scenarioLicense.findUnique({
    where: { userId_scenarioId_type: { userId: buyerId, scenarioId: id, type } },
  });
  if (existing) {
    return NextResponse.json({ error: `You already own the ${type} license` }, { status: 409 });
  }

  const buyer = await prisma.user.findUnique({ where: { id: buyerId } });
  if (!buyer || buyer.credits < buyerPays) {
    return NextResponse.json({ error: "Insufficient credits", needed: buyerPays, have: buyer?.credits ?? 0 }, { status: 402 });
  }

  const sellerId = scenario.userId;

  // Find the platform account (user with email "platform@game-forge.ai") if it
  // exists — used to log the tax credit. Silently skipped if not configured.
  const platformUser = platformGets > 0
    ? await prisma.user.findFirst({ where: { email: "platform@game-forge.ai" } })
    : null;

  await prisma.$transaction([
    prisma.user.update({ where: { id: buyerId }, data: { credits: { decrement: buyerPays } } }),
    prisma.user.update({ where: { id: sellerId }, data: { credits: { increment: sellerGets } } }),
    ...(platformUser && platformGets > 0 ? [
      prisma.user.update({ where: { id: platformUser.id }, data: { credits: { increment: platformGets } } }),
      prisma.creditTransaction.create({
        data: { userId: platformUser.id, amount: platformGets, reason: "platform_tax" },
      }),
    ] : []),
    prisma.scenarioLicense.create({
      data: { userId: buyerId, scenarioId: id, type, amount: buyerPays },
    }),
    prisma.creditTransaction.create({
      data: { userId: buyerId, amount: -buyerPays, reason: type === "PLAY" ? "play_purchase" : "clone_purchase" },
    }),
    prisma.creditTransaction.create({
      data: { userId: sellerId, amount: sellerGets, reason: "sale" },
    }),
  ]);

  return NextResponse.json({ success: true, type });
}

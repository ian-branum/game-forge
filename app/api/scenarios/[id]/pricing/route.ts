import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const body = await req.json().catch(() => null);
  const priceToPlay = Number(body?.priceToPlay);
  const priceToClone = Number(body?.priceToClone);

  // Validate: both must be non-negative integers
  if (
    !Number.isInteger(priceToPlay) || priceToPlay < 0 ||
    !Number.isInteger(priceToClone) || priceToClone < 0
  ) {
    return NextResponse.json(
      { error: "priceToPlay and priceToClone must be non-negative integers" },
      { status: 400 }
    );
  }

  // Only the owner can set pricing
  const scenario = await prisma.scenario.findUnique({ where: { id } });
  if (!scenario) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (scenario.userId !== session.user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.scenario.update({
    where: { id },
    data: { priceToPlay, priceToClone },
  });

  return NextResponse.json({ ok: true });
}

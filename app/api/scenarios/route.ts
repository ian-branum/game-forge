import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const mine = searchParams.get("mine") === "true";
  const category = searchParams.get("category"); // null = all

  const scenarios = await prisma.scenario.findMany({
    where: {
      ...(mine ? { userId: session.user.id } : {}),
      archived: false,
      ...(category ? { category } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      userId: true,
      title: true,
      category: true,
      prompt: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ scenarios, currentUserId: session.user.id });
}

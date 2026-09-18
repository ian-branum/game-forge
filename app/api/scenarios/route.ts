import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const archived = searchParams.get("archived") === "true";
  const category = searchParams.get("category"); // null = all

  const rows = await prisma.scenario.findMany({
    where: {
      // My Games is always scoped to the current user's own created scenarios.
      userId: session.user.id,
      archived: archived ? true : false,
      ...(category && category !== "all" ? { category } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      userId: true,
      title: true,
      description: true,
      category: true,
      prompt: true,
      isPublic: true,
      priceToPlay: true,
      priceToClone: true,
      activeVersionId: true,
      archived: true,
      versions: {
        select: { id: true, versionNum: true, prompt: true, createdAt: true },
        orderBy: { versionNum: "asc" },
      },
      user: {
        select: { displayName: true, name: true },
      },
      createdAt: true,
    },
  });

  // Strip the raw user object; expose a resolved creator display name instead.
  const scenarios = rows.map(({ user, ...rest }) => ({
    ...rest,
    creator: user?.displayName ?? user?.name ?? "Unknown",
  }));

  return NextResponse.json({ scenarios, currentUserId: session.user.id });
}

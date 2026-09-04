import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

// DELETE: remove a version (auto-promote if it was the active one)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, versionId } = await params;

  // Only the owner can delete versions of their own scenario
  const scenario = await prisma.scenario.findUnique({
    where: { id },
    include: {
      versions: {
        select: { id: true, versionNum: true, payload: true },
        orderBy: { versionNum: "asc" },
      },
    },
  });
  if (!scenario) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (scenario.userId !== session.user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const version = scenario.versions.find(v => v.id === versionId);
  if (!version) return NextResponse.json({ error: "Version not found" }, { status: 404 });

  // Block deleting the only remaining version
  if (scenario.versions.length <= 1) {
    return NextResponse.json({ error: "Cannot delete the only version" }, { status: 400 });
  }

  const wasActive = scenario.activeVersionId === versionId;
  let newActiveVersionId: string | null = null;

  await prisma.$transaction(async (tx) => {
    await tx.gameVersion.delete({ where: { id: versionId } });

    if (wasActive) {
      // Auto-promote: highest versionNum among the remaining versions
      const remaining = scenario.versions.filter(v => v.id !== versionId);
      const promoted = remaining[remaining.length - 1];
      newActiveVersionId = promoted.id;
      await tx.scenario.update({
        where: { id },
        data: { activeVersionId: promoted.id, payload: promoted.payload as Prisma.InputJsonValue },
      });
    }
  });

  return NextResponse.json({ ok: true, newActiveVersionId });
}

// PATCH: set a version as the active one
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, versionId } = await params;

  // Only the owner can change the active version
  const scenario = await prisma.scenario.findUnique({ where: { id } });
  if (!scenario) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (scenario.userId !== session.user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Verify the version belongs to this scenario
  const version = await prisma.gameVersion.findUnique({ where: { id: versionId } });
  if (!version || version.scenarioId !== id)
    return NextResponse.json({ error: "Version not found" }, { status: 404 });

  await prisma.scenario.update({
    where: { id },
    data: { activeVersionId: versionId, payload: version.payload as Prisma.InputJsonValue },
  });

  return NextResponse.json({ ok: true });
}

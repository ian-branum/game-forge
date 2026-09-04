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

  const { id } = await params;

  const body = await req.json().catch(() => null);
  const modificationPrompt =
    typeof body?.modificationPrompt === "string" ? body.modificationPrompt.trim() : "";
  if (!modificationPrompt) {
    return NextResponse.json({ error: "modificationPrompt must be a non-empty string" }, { status: 400 });
  }

  // Only the owner can modify their own scenario
  const scenario = await prisma.scenario.findUnique({ where: { id } });
  if (!scenario) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (scenario.userId !== session.user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Record the modification prompt for future re-generation work
  const updated = await prisma.scenario.update({
    where: { id },
    data: { modificationPrompts: { push: modificationPrompt } },
    select: { id: true, modificationPrompts: true },
  });

  return NextResponse.json({ ok: true, scenario: updated });
}

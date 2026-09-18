import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// PATCH /api/scenarios/[id]
// Body: { title?: string, description?: string }
// Owner only. Title min 1 char, description max 300 chars.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const body = (await req.json().catch(() => null)) as
    | { title?: unknown; description?: unknown }
    | null;

  if (!body || (body.title === undefined && body.description === undefined)) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const data: { title?: string; description?: string | null } = {};

  if (body.title !== undefined) {
    if (typeof body.title !== "string" || body.title.trim().length < 1) {
      return NextResponse.json({ error: "Title must be at least 1 character" }, { status: 400 });
    }
    data.title = body.title.trim();
  }

  if (body.description !== undefined) {
    if (typeof body.description !== "string") {
      return NextResponse.json({ error: "Description must be a string" }, { status: 400 });
    }
    if (body.description.length > 300) {
      return NextResponse.json({ error: "Description must be 300 characters or fewer" }, { status: 400 });
    }
    const trimmed = body.description.trim();
    data.description = trimmed.length === 0 ? null : trimmed;
  }

  const scenario = await prisma.scenario.findUnique({ where: { id } });
  if (!scenario) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (scenario.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updated = await prisma.scenario.update({
    where: { id },
    data,
    select: { title: true, description: true },
  });

  return NextResponse.json({ title: updated.title, description: updated.description });
}

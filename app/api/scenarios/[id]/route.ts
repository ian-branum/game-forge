import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ScenarioDefinitionSchema } from "@/games/tactical/schema";

// PATCH /api/scenarios/[id]
// Body: { title?: string, description?: string } — metadata edit
//    or { payload: ScenarioDefinition }            — scenario editor save
// Owner only. Title min 1 char, description max 300 chars. A payload save is
// validated against the tactical scenario schema before it is stored.
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
    | { title?: unknown; description?: unknown; payload?: unknown }
    | null;

  // ── Scenario editor save ──────────────────────────────────────────────────
  if (body && body.payload !== undefined) {
    const scenario = await prisma.scenario.findUnique({
      where: { id },
      select: { userId: true, category: true },
    });
    if (!scenario) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (scenario.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (scenario.category !== "tactical") {
      return NextResponse.json(
        { error: "Only tactical scenarios can be saved from the editor" },
        { status: 400 }
      );
    }
    if (!body.payload || typeof body.payload !== "object" || Array.isArray(body.payload)) {
      return NextResponse.json({ error: "Invalid scenario payload" }, { status: 400 });
    }

    // The stored payload carries its own id; make sure it always matches the row.
    const candidate = { ...(body.payload as Record<string, unknown>), id };
    const parsed = ScenarioDefinitionSchema.safeParse(candidate);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return NextResponse.json(
        { error: `Invalid scenario: ${first?.path.join(".") || "payload"} — ${first?.message}` },
        { status: 400 }
      );
    }

    await prisma.scenario.update({
      where: { id },
      data: { payload: parsed.data },
    });

    return NextResponse.json({ ok: true });
  }

  // ── Metadata edit ─────────────────────────────────────────────────────────
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

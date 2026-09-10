import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { classifyGame } from "@/games/classifier/classify-game";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { prompt } = await req.json() as { prompt?: string };
  if (!prompt) {
    return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
  }

  try {
    const result = await classifyGame(prompt);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[/api/classify]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

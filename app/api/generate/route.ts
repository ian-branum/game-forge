import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateTacticalScenario } from "@/lib/generators/tactical";
import { generateTriviaScenario } from "@/lib/generators/trivia";
import { generateWordPuzzle } from "@/lib/generators/word";
import { generateLogicPuzzle } from "@/lib/generators/puzzle";
import { generateCardScenario } from "@/lib/generators/card";
import { generateNarrativeScenario } from "@/lib/generators/narrative";

const GENERATION_COSTS: Record<string, number> = {
  tactical:  3,
  trivia:    1,
  word:      2,
  puzzle:    1,
  card:      2,
  narrative: 4,
};

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { prompt, category } = await req.json();
  if (!prompt || !category) {
    return NextResponse.json({ error: "Missing prompt or category" }, { status: 400 });
  }

  const cost = GENERATION_COSTS[category] ?? 2;
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user || user.credits < cost) {
    return NextResponse.json({ error: "Insufficient credits", needed: cost, have: user?.credits ?? 0 }, { status: 402 });
  }

  let payload: unknown;
  try {
    switch (category) {
      case "tactical":  payload = await generateTacticalScenario(prompt); break;
      case "trivia":    payload = await generateTriviaScenario(prompt); break;
      case "word":      payload = await generateWordPuzzle(prompt); break;
      case "puzzle":    payload = await generateLogicPuzzle(prompt); break;
      case "card":      payload = await generateCardScenario(prompt); break;
      case "narrative": payload = await generateNarrativeScenario(prompt); break;
      default:
        return NextResponse.json({ error: `Unknown category: ${category}` }, { status: 400 });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[/api/generate] Generation failed:", msg, stack);
    return NextResponse.json({ error: msg, stack, category, prompt }, { status: 500 });
  }

  const [scenario] = await prisma.$transaction([
    prisma.scenario.create({
      data: {
        userId: session.user.id,
        category,
        title: (payload as { title?: string }).title ?? "Untitled",
        prompt,
        payload: payload as object,
      },
    }),
    prisma.user.update({
      where: { id: session.user.id },
      data: { credits: { decrement: cost } },
    }),
    prisma.creditTransaction.create({
      data: {
        userId: session.user.id,
        amount: -cost,
        reason: "generation",
      },
    }),
  ]);

  return NextResponse.json({ id: scenario.id });
}

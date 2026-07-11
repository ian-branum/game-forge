import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateTacticalScenario } from "@/lib/generators/tactical";

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
    if (category === "tactical") {
      payload = await generateTacticalScenario(prompt);
    } else {
      return NextResponse.json({ error: `Category '${category}' not yet implemented` }, { status: 400 });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "AI generation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // Deduct credits + save scenario atomically
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

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  // Fetch pool of isDemo=true, not archived, for each category
  const [tactical, sandbox] = await Promise.all([
    prisma.scenario.findMany({
      where: { isDemo: true, archived: false, category: "tactical" },
      select: { id: true, title: true, category: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.scenario.findMany({
      where: { isDemo: true, archived: false, category: "sandbox" },
      select: { id: true, title: true, category: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  // Fisher-Yates shuffle and pick 3 from each
  function pickRandom<T>(arr: T[], n: number): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a.slice(0, n);
  }

  return NextResponse.json({
    tactical: pickRandom(tactical, 3),
    sandbox: pickRandom(sandbox, 3),
  });
}

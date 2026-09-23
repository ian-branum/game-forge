import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// GET /api/me/credits
// Live credit balance for the signed-in user. The JWT bakes in `credits` at
// sign-in and never refreshes, so the Nav fetches this on route changes instead.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { credits: true },
  });
  return NextResponse.json({ credits: user?.credits ?? 0 });
}

import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import Stripe from "stripe";

// Stripe requires the raw body for signature verification — disable Next.js body parsing
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const { userId, credits } = session.metadata ?? {};

    if (!userId || !credits) {
      console.error("Webhook missing metadata:", session.metadata);
      return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
    }

    const creditCount = parseInt(credits, 10);
    if (isNaN(creditCount) || creditCount <= 0) {
      console.error("Invalid credit count in metadata:", credits);
      return NextResponse.json({ error: "Invalid credit count" }, { status: 400 });
    }

    // Idempotency guard — check if we already processed this session
    const existing = await prisma.creditTransaction.findFirst({
      where: { reason: `stripe:${session.id}` },
    });
    if (existing) {
      console.log("Already processed session:", session.id);
      return NextResponse.json({ received: true });
    }

    // Credit the user atomically
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { credits: { increment: creditCount } },
      }),
      prisma.creditTransaction.create({
        data: {
          userId,
          amount: creditCount,
          reason: `stripe:${session.id}`,
        },
      }),
    ]);

    console.log(`Credited ${creditCount} credits to user ${userId} (session ${session.id})`);
  }

  return NextResponse.json({ received: true });
}

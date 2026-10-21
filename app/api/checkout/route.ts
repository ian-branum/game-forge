import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { stripe, CREDIT_PACKS, PackId } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { packId } = await req.json() as { packId: PackId };
  const pack = CREDIT_PACKS.find(p => p.id === packId);
  if (!pack) {
    return NextResponse.json({ error: "Invalid pack" }, { status: 400 });
  }

  const baseUrl = req.nextUrl.origin;

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "payment",
    managed_payments: { enabled: false },
    line_items: [
      {
        price: pack.priceId,
        quantity: 1,
      },
    ],
    metadata: {
      userId: session.user.id,
      packId: pack.id,
      credits: String(pack.credits),
    },
    success_url: `${baseUrl}/credits?success=1&pack=${pack.id}`,
    cancel_url: `${baseUrl}/credits?cancelled=1`,
  });

  return NextResponse.json({ url: checkoutSession.url });
}

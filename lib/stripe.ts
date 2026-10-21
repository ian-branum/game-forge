import Stripe from "stripe";

// Server-only — never import this file in client components
// Lazy singleton so it's not instantiated at build time when env vars are absent
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2026-09-30.endive",
    });
  }
  return _stripe;
}

export { CREDIT_PACKS } from "@/lib/credit-packs";
export type { PackId } from "@/lib/credit-packs";

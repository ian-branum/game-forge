import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-09-30.endive",
});

export const CREDIT_PACKS = [
  {
    id: "starter",
    label: "Starter",
    desc: "Try it out",
    credits: 10,
    price: 400,      // cents — for display only
    priceId: "price_1UT0o1BKdEs0OlCtr0VoVfhK",
    highlight: false,
  },
  {
    id: "standard",
    label: "Standard",
    desc: "Most popular",
    credits: 50,
    price: 1500,     // cents — for display only
    priceId: "price_1UT0oUBKdEs0OlCtk9wHyudZ",
    highlight: true,
  },
  {
    id: "power",
    label: "Power",
    desc: "For serious commanders",
    credits: 200,
    price: 5000,     // cents — for display only
    priceId: "price_1UT0orBKdEs0OlCtTGczNheX",
    highlight: false,
  },
] as const;

export type PackId = (typeof CREDIT_PACKS)[number]["id"];

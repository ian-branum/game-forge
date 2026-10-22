// Shared credit pack definitions — safe to import on client or server
// Price IDs are injected via env vars so test/live keys work across environments:
//   STRIPE_PRICE_STARTER, STRIPE_PRICE_STANDARD, STRIPE_PRICE_POWER
export const CREDIT_PACKS = [
  {
    id: "starter",
    label: "Starter",
    desc: "Try it out",
    credits: 10,
    price: 400,      // cents — for display only
    priceId: process.env.STRIPE_PRICE_STARTER ?? "price_1UT0o1BKdEs0OlCtr0VoVfhK",
    highlight: false,
  },
  {
    id: "standard",
    label: "Standard",
    desc: "Most popular",
    credits: 50,
    price: 1500,     // cents — for display only
    priceId: process.env.STRIPE_PRICE_STANDARD ?? "price_1UT0oUBKdEs0OlCtk9wHyudZ",
    highlight: true,
  },
  {
    id: "power",
    label: "Power",
    desc: "For serious commanders",
    credits: 200,
    price: 5000,     // cents — for display only
    priceId: process.env.STRIPE_PRICE_POWER ?? "price_1UT0orBKdEs0OlCtTGczNheX",
    highlight: false,
  },
] as const;

export type PackId = (typeof CREDIT_PACKS)[number]["id"];

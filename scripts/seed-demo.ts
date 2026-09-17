import { prisma } from "../lib/prisma";

async function main() {
  const result = await prisma.scenario.updateMany({ data: { isDemo: true } });
  console.log("Updated:", result.count, "scenarios → isDemo=true");
}

main().catch(console.error).finally(() => prisma.$disconnect());

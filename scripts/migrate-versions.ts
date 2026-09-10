/**
 * One-time migration: create a v1 GameVersion for every existing Scenario
 * that doesn't already have one, and set activeVersionId to point to it.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  const scenarios = await prisma.scenario.findMany({
    where: { activeVersionId: null },
    select: { id: true, prompt: true, payload: true },
  });

  console.log(`Migrating ${scenarios.length} scenarios…`);

  for (const s of scenarios) {
    const version = await prisma.gameVersion.create({
      data: {
        scenarioId: s.id,
        versionNum: 1,
        prompt: s.prompt,
        payload: s.payload as object,
      },
    });
    await prisma.scenario.update({
      where: { id: s.id },
      data: { activeVersionId: version.id },
    });
    console.log(`  ✓ scenario ${s.id} → GameVersion ${version.id} (v1)`);
  }

  console.log("Done.");
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

// Knight FM — Task 88: seed demo Solana config so the wallet shows the SYSTEM
// DEPOSIT ADDRESS + QR in this environment. rpc.url stays EMPTY on purpose:
// deposit verification then answers an honest 503 DEPOSIT_UNAVAILABLE and
// nothing is ever credited until a real endpoint is configured.
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const DEMO = {
  "solana.systemWallet": "Kn1ghtSy5D3m0Wa11et1111111111111111111111111",
  "solana.mint": "Kn1ghtM1ntD3m01111111111111111111111111111111",
};

for (const [key, value] of Object.entries(DEMO)) {
  await db.configKey.upsert({
    where: { key },
    create: { key, group: "solana", valueType: "string", defaultValue: "", currentValue: value, description: "Task 88 demo seed (sandbox only)" },
    update: { currentValue: value },
  });
  console.log("seeded", key);
}
await db.$disconnect();

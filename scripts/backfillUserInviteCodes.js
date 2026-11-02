/**
 * Assign inviteCode to all users missing one. Safe to re-run.
 *
 * Usage: node scripts/backfillUserInviteCodes.js
 */
import dotenv from "dotenv";
import { prisma } from "../config/db.js";
import { ensureUserInviteCode } from "../utils/referralService.js";

dotenv.config();

const BATCH_SIZE = 100;

async function main() {
  let updated = 0;

  for (;;) {
    const users = await prisma.user.findMany({
      where: { inviteCode: null },
      select: { id: true },
      take: BATCH_SIZE,
      orderBy: { id: "asc" },
    });

    if (users.length === 0) {
      break;
    }

    for (const user of users) {
      await ensureUserInviteCode(user.id);
      updated += 1;
    }

    console.log(`Backfilled batch (${updated} total so far)`);
  }

  console.log(`Done. Assigned invite codes to ${updated} user(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

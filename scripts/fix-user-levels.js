/**
 * fix-user-levels.js
 * 
 * One-time migration script to recalculate level + xp_progress
 * for all users based on their xp_earned (lifetime total).
 * 
 * Run with:
 *   node scripts/fix-user-levels.js
 * 
 * Use --dry-run to preview changes without writing to DB:
 *   node scripts/fix-user-levels.js --dry-run
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const isDryRun = process.argv.includes('--dry-run');

// Same formula used in the app
const xpRequired = (level) => 100 * level * level;

/**
 * Given lifetime xp_earned, calculate the correct level and xp_progress (bank).
 * Always starts from level 1 and consumes from total XP earned.
 */
function calculateLevelFromXp(totalXp) {
    let lv = 1;
    let remaining = Math.max(0, totalXp);

    while (remaining >= xpRequired(lv)) {
        remaining -= xpRequired(lv);
        lv += 1;
    }

    return { level: lv, xp_progress: remaining };
}

async function main() {
    console.log(`\n🔧 Raidr — User Level Migration`);
    console.log(`Mode: ${isDryRun ? '🟡 DRY RUN (no DB writes)' : '🔴 LIVE (writing to DB)'}`);
    console.log('─'.repeat(50));

    // Fetch all users
    const users = await prisma.user.findMany({
        select: {
            id: true,
            name: true,
            xp_earned: true,
            xp_progress: true,
            level: true,
        }
    });

    console.log(`\nFound ${users.length} users to process.\n`);

    let fixed = 0;
    let alreadyCorrect = 0;
    let errors = 0;

    for (const user of users) {
        try {
            const { level: correctLevel, xp_progress: correctBank } = calculateLevelFromXp(user.xp_earned);

            const levelIsWrong    = user.level      !== correctLevel;
            const progressIsWrong = user.xp_progress !== correctBank;

            if (!levelIsWrong && !progressIsWrong) {
                alreadyCorrect++;
                continue;
            }

            // Log what's changing
            console.log(`👤 ${user.name || user.id}`);
            console.log(`   xp_earned   : ${user.xp_earned}`);
            console.log(`   level       : ${user.level} → ${correctLevel}   ${levelIsWrong ? '⚠️ FIXING' : '✅'}`);
            console.log(`   xp_progress : ${user.xp_progress} → ${correctBank}   ${progressIsWrong ? '⚠️ FIXING' : '✅'}`);
            console.log('');

            if (!isDryRun) {
                await prisma.user.update({
                    where: { id: user.id },
                    data: {
                        level: correctLevel,
                        xp_progress: correctBank
                    }
                });
            }

            fixed++;
        } catch (err) {
            console.error(`❌ Error processing user ${user.id}:`, err.message);
            errors++;
        }
    }

    console.log('─'.repeat(50));
    console.log(`\n✅ Summary:`);
    console.log(`   Already correct : ${alreadyCorrect}`);
    console.log(`   Fixed           : ${fixed}`);
    console.log(`   Errors          : ${errors}`);

    if (isDryRun && fixed > 0) {
        console.log(`\n🟡 DRY RUN complete. Run without --dry-run to apply these ${fixed} fix(es) to the DB.`);
    } else if (!isDryRun && fixed > 0) {
        console.log(`\n🎉 Done! ${fixed} user(s) updated in the DB.`);
    } else {
        console.log(`\n✨ All users were already at the correct level. Nothing to fix.`);
    }
}

main()
    .catch((e) => {
        console.error('Fatal error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

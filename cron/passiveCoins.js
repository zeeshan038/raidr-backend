import { prisma } from '../config/db.js';
import { getSpGameConfig } from '../utils/singlePlayerConfig.js';
import { applyPassiveCoinsWithDailyCap, economyFromConfigRow } from '../utils/economyConfig.js';
import {
  isSinglePlayerZoneTableReady,
  logSinglePlayerCronSkippedOnce,
  handleSinglePlayerSchemaError,
} from '../utils/singlePlayerSchemaReady.js';
import { incrementZonePassiveLedger } from '../utils/singlePlayerZonePassiveLedger.js';
import { broadcastSinglePlayerZoneLeaderboard } from '../utils/singlePlayerZoneLeaderboard.js';

/** Round-robin tie-break when splitting a small award across many owned zones. */
const passiveLedgerRotateByOwner = new Map();

/**
 * Split `awarded` coins across zones proportional to `base`, with remainder rotated per owner.
 * @param {{ zoneId: string, base: number }[]} zoneEntries
 * @returns {{ zoneId: string, share: number }[]}
 */
const splitPassiveAwardAcrossZones = (zoneEntries, awarded, ownerId) => {
    if (awarded <= 0 || !zoneEntries?.length) return [];

    const totalBase = zoneEntries.reduce((sum, z) => sum + z.base, 0);
    if (totalBase <= 0) return [];

    const sorted = [...zoneEntries].sort((a, b) => a.zoneId.localeCompare(b.zoneId));
    const shares = sorted.map((e) => Math.floor((awarded * e.base) / totalBase));
    let remainder = awarded - shares.reduce((sum, n) => sum + n, 0);

    let rotate = passiveLedgerRotateByOwner.get(ownerId) ?? 0;
    const n = sorted.length;
    for (let r = 0; r < remainder; r++) {
        shares[(rotate + r) % n] += 1;
    }
    passiveLedgerRotateByOwner.set(ownerId, (rotate + remainder) % n);

    return sorted.map((e, i) => ({ zoneId: e.zoneId, share: shares[i] }));
};

/**
 * @Description Job that awards passive income to players who own a shielded Single Player Zone
 */
export const startPassiveCoinsCron = () => {
    // Run every 5 minutes (5 * 60 * 1000)
    const CRON_INTERVAL_MS = 5 * 60 * 1000;
    const CRON_INTERVAL_HOURS = 5 / 60;

    const runPassiveCoins = async () => {
        try {
            if (!(await isSinglePlayerZoneTableReady(prisma))) {
                logSinglePlayerCronSkippedOnce('Passive coins');
                return;
            }

            const now = new Date();
            
            // Passive income for all owned zones (Phase 2 — not limited to shield window)
            const shieldedZones = await prisma.singlePlayerZone.findMany({
                where: {
                    isActive: true,
                    currentOwnerId: { not: null },
                }
            });

            if (shieldedZones.length === 0) return;

            const [configRow, users] = await Promise.all([
                getSpGameConfig(prisma),
                prisma.user.findMany({
                    where: {
                        id: {
                            in: [...new Set(shieldedZones.map((z) => z.currentOwnerId))],
                        },
                    },
                    select: { id: true, coinBoostMultiplier: true, coinBoostExpiresAt: true },
                }),
            ]);

            const economy = economyFromConfigRow(configRow);
            const vipMin = configRow.empireVipMinOwnedZones ?? 5;
            const vipMultiplier = configRow.vipRewardMultiplier ?? 1.25;
            const dailyCap = economy.passiveCoinsDailyCapPerUser;

            const ownedCounts = {};
            /** @type {Record<string, { zoneId: string, base: number }[]>} */
            const ownerZoneBases = {};

            for (const zone of shieldedZones) {
                ownedCounts[zone.currentOwnerId] = (ownedCounts[zone.currentOwnerId] || 0) + 1;
                const coinsToAward = Math.floor(zone.coinsPerHour * CRON_INTERVAL_HOURS);
                if (coinsToAward <= 0) continue;
                if (!ownerZoneBases[zone.currentOwnerId]) {
                    ownerZoneBases[zone.currentOwnerId] = [];
                }
                ownerZoneBases[zone.currentOwnerId].push({
                    zoneId: zone.id,
                    base: coinsToAward,
                });
            }

            const userMap = {};
            for (const user of users) {
                userMap[user.id] = user;
            }

            let awardedUsers = 0;
            const zoneIdsToBroadcast = new Set();
            for (const [ownerId, zoneEntries] of Object.entries(ownerZoneBases)) {
                const totalBase = zoneEntries.reduce((sum, z) => sum + z.base, 0);
                if (totalBase <= 0) continue;

                const user = userMap[ownerId];
                let finalCoins = totalBase;

                if (user && user.coinBoostExpiresAt && user.coinBoostExpiresAt > now) {
                    const multiplier = user.coinBoostMultiplier || 1.0;
                    finalCoins = Math.floor(finalCoins * multiplier);
                }

                if ((ownedCounts[ownerId] || 0) >= vipMin && vipMultiplier > 1) {
                    finalCoins = Math.floor(finalCoins * vipMultiplier);
                }

                if (finalCoins <= 0) continue;

                const { awarded } = await applyPassiveCoinsWithDailyCap(
                    prisma,
                    ownerId,
                    finalCoins,
                    dailyCap
                );
                if (awarded <= 0) continue;

                awardedUsers += 1;

                const splits = splitPassiveAwardAcrossZones(zoneEntries, awarded, ownerId);
                for (const { zoneId, share } of splits) {
                    if (share <= 0) continue;
                    await incrementZonePassiveLedger(prisma, zoneId, ownerId, share);
                    zoneIdsToBroadcast.add(zoneId);
                }
            }

            for (const zoneId of zoneIdsToBroadcast) {
                void broadcastSinglePlayerZoneLeaderboard(prisma, zoneId);
            }

            console.log(`[Cron] Passive coins awarded to ${awardedUsers} players.`);
        } catch (error) {
            if (handleSinglePlayerSchemaError(error, 'Passive coins')) return;
            console.error('[Cron] Error running passive coins job:', error);
        }
    };

    setInterval(runPassiveCoins, CRON_INTERVAL_MS);
};

/**
 * Unit-style checks for zone leaderboard ranking (no DB).
 * Run: node scripts/testZoneLeaderboard.js
 */
import assert from "node:assert/strict";

const mapLedgerRowsToRankedEntries = (rows, avatarById, viewerUserId) => {
  const sorted = [...rows].sort((a, b) => {
    if (b.coinsEarned !== a.coinsEarned) return b.coinsEarned - a.coinsEarned;
    return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
  });

  return sorted.map((row, index) => {
    let avatarUrl = "";
    const avatarId = row.user?.selectedAvatarId;
    if (avatarId && avatarById[avatarId]) avatarUrl = avatarById[avatarId];

    return {
      rank: index + 1,
      userId: row.userId,
      coins: row.coinsEarned,
      avatarUrl,
      isYou: Boolean(viewerUserId && row.userId === viewerUserId),
    };
  });
};

const rows = [
  {
    userId: "b",
    coinsEarned: 10,
    updatedAt: "2026-01-02T00:00:00.000Z",
    user: { selectedAvatarId: null },
  },
  {
    userId: "a",
    coinsEarned: 10,
    updatedAt: "2026-01-01T00:00:00.000Z",
    user: { selectedAvatarId: null },
  },
  {
    userId: "c",
    coinsEarned: 5,
    updatedAt: "2026-01-03T00:00:00.000Z",
    user: { selectedAvatarId: null },
  },
  {
    userId: "d",
    coinsEarned: 1,
    updatedAt: "2026-01-04T00:00:00.000Z",
    user: { selectedAvatarId: null },
  },
];

const entries = mapLedgerRowsToRankedEntries(rows, {}, "d");
assert.equal(entries[0].userId, "a", "tie-break earlier updatedAt first");
assert.equal(entries[3].rank, 4);
assert.equal(entries[3].isYou, true);

const top = entries.slice(0, 3);
const viewer = entries.find((e) => e.userId === "d" && e.rank > 3);
assert(viewer && viewer.rank === 4);

console.log("testZoneLeaderboard: ok");

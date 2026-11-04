/**
 * Smoke test: NORMAL zone competitive passive bar + snatch captureProgressPercent.
 *
 *   node scripts/testNormalPassiveProgress.js
 */
import {
  computeB2bPassiveCoinProgress,
  computeNormalPassiveCoinProgress,
  computeNormalPassiveIncomePreview,
  computeZonePassiveIncomePreview,
  formatSinglePlayerZoneForClient,
} from "../utils/singlePlayerZone.js";
import { formatActiveCaptureSessionFromAttempt } from "../utils/singlePlayerCapture.js";

const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

function runUnitTests() {
  const ownedAt = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const zone = {
    zoneType: "NORMAL",
    coinsPerHour: 60,
    ownedAt,
    currentOwnerId: "user-a",
    guardCount: 0,
    isActive: true,
    latitude: 40.78,
    longitude: -73.96,
    radius: 50,
    name: "Test Zone",
    id: "00000000-0000-4000-8000-000000000001",
  };

  const behind = computeNormalPassiveCoinProgress(zone, {
    yourCoins: 3,
    leaderCoins: 10,
    leaderUserId: "user-b",
  });
  assert(behind.progressPercent === 30, "3/10 leader => 30%");
  assert(behind.yourCoinsFromZone === 3, "yourCoinsFromZone");
  assert(behind.leaderCoinsFromZone === 10, "leaderCoinsFromZone");
  assert(behind.isLeader === false, "not leader");

  const leader = computeNormalPassiveCoinProgress(zone, {
    yourCoins: 10,
    leaderCoins: 10,
    leaderUserId: "user-a",
  });
  assert(leader.progressPercent === 100, "leader at 100%");
  assert(leader.isLeader === true, "isLeader");

  assert(
    computeNormalPassiveCoinProgress({ ...zone, zoneType: "B2B" }) === null,
    "B2B should not use normal passive progress"
  );
  assert(
    computeNormalPassiveCoinProgress({ ...zone, ownedAt: null }) === null,
    "no ownedAt => null"
  );

  const zero = computeNormalPassiveCoinProgress(zone, { yourCoins: 0, leaderCoins: 0 });
  assert(zero.progressPercent === 0, "no earnings => 0%");

  const preview = computeNormalPassiveIncomePreview(zone);
  assert(preview?.coinsPerHour === 60, "preview coinsPerHour");

  const formatted = formatSinglePlayerZoneForClient(zone, "user-a", new Date());
  assert(formatted.normal === null, "passiveEarning attached via enrich, not format");

  const session = formatActiveCaptureSessionFromAttempt({
    startedAt: Date.now() - 45_000,
    captureTimeSec: 90,
    initialGuardCount: 0,
    sessionGuardsRemaining: 0,
    guardsEliminatedInSession: 0,
  });
  assert(session.captureProgressPercent === 50, "captureProgressPercent should be 50 at 45/90s");

  const b2bZone = {
    zoneType: "B2B",
    coinsPerHour: 10,
    holdDurationHours: 24,
    holdStartedAt: new Date(),
    currentOwnerId: "user-a",
    id: "b2b-1",
  };
  const b2bPreview = computeZonePassiveIncomePreview(b2bZone);
  assert(b2bPreview?.coinsPerHour === 10, "B2B zone passive preview");
  assert(computeNormalPassiveIncomePreview(b2bZone) === null, "NORMAL-only preview null on B2B");

  const b2bCoins = computeB2bPassiveCoinProgress(b2bZone, 24);
  assert(b2bCoins.maxCoinsFromHold === 240, "24h * 10/h = 240 max");
  assert(b2bCoins.coinProgressPercent === 10, "24/240 = 10%");
  assert(b2bCoins.coinsEarnedInHold === 24, "coinsEarnedInHold");

  console.log("[OK] Unit tests passed (NORMAL competitive + B2B passive + captureProgressPercent).");
}

const live = process.argv.includes("--live");
try {
  runUnitTests();
  if (live) {
    console.log("[SKIP] Live check unchanged — set USER_TOKEN, ZONE_ID, API_BASE.");
  }
  process.exit(0);
} catch (err) {
  console.error("[FAIL]", err.message);
  process.exit(1);
}

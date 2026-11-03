/**
 * Smoke test: NORMAL zone passive coin bar + snatch captureProgressPercent (no server required).
 *
 *   node scripts/testNormalPassiveProgress.js
 *
 * Optional live API check (server + DB + Redis running):
 *   API_BASE=http://localhost:3000/api USER_TOKEN=eyJ... ZONE_ID=uuid node scripts/testNormalPassiveProgress.js --live
 */
import {
  computeNormalPassiveCoinProgress,
  computeNormalPassiveIncomePreview,
  formatSinglePlayerZoneForClient,
  PASSIVE_COINS_CRON_INTERVAL_MS,
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

  const progress = computeNormalPassiveCoinProgress(zone, new Date());
  assert(progress !== null, "passive progress should exist for owned NORMAL zone");
  assert(
    progress.progressPercent >= 0 && progress.progressPercent <= 100,
    "progressPercent out of range"
  );
  assert(progress.accrualCycleMinutes === 5, "accrualCycleMinutes should be 5");
  assert(progress.coinsPerAccrualCycle === 5, "expected 5 coins per 5min at 60/hr");
  assert(
    progress.estimatedCoinsSinceOwned >= 100,
    "estimatedCoinsSinceOwned should reflect ~2h at 60/hr"
  );

  assert(
    computeNormalPassiveCoinProgress({ ...zone, zoneType: "B2B" }) === null,
    "B2B should not use normal passive progress"
  );
  assert(
    computeNormalPassiveCoinProgress({ ...zone, ownedAt: null }) === null,
    "no ownedAt => null"
  );

  const preview = computeNormalPassiveIncomePreview(zone);
  assert(preview?.coinsPerHour === 60, "preview coinsPerHour");
  assert(preview?.coinsPerAccrualCycle === 5, "preview coinsPerAccrualCycle");

  const formatted = formatSinglePlayerZoneForClient(zone, "user-a", new Date());
  assert(formatted.normal?.passiveEarning?.progressPercent != null, "formatted normal.passiveEarning");
  assert(formatted.normal?.passiveIncomePreview == null, "owned zone should not use preview");

  const formattedOther = formatSinglePlayerZoneForClient(zone, "user-b", new Date());
  assert(formattedOther.normal === null, "non-owner should not get passiveEarning block");

  const midCycleMs =
    Math.floor(Date.now() / PASSIVE_COINS_CRON_INTERVAL_MS) * PASSIVE_COINS_CRON_INTERVAL_MS +
    PASSIVE_COINS_CRON_INTERVAL_MS / 2;
  const half = computeNormalPassiveCoinProgress(zone, new Date(midCycleMs));
  assert(half.progressPercent >= 40 && half.progressPercent <= 60, "mid-cycle progress ~50%");

  const session = formatActiveCaptureSessionFromAttempt({
    startedAt: Date.now() - 45_000,
    captureTimeSec: 90,
    initialGuardCount: 0,
    sessionGuardsRemaining: 0,
    guardsEliminatedInSession: 0,
  });
  assert(session.captureProgressPercent === 50, "captureProgressPercent should be 50 at 45/90s");
  assert(session.remainingSec === 45, "remainingSec");

  console.log("[OK] Unit tests passed (normal passive + captureProgressPercent).");
}

async function runLiveCheck() {
  const base = process.env.API_BASE || "http://localhost:3000/api";
  const token = process.env.USER_TOKEN;
  const zoneId = process.env.ZONE_ID;
  if (!token || !zoneId) {
    console.log("[SKIP] Live API: set USER_TOKEN and ZONE_ID to run --live checks.");
    return;
  }

  const res = await fetch(`${base}/single-player/zones/${zoneId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  assert(res.ok && json.status !== false, `GET zone failed: ${res.status} ${JSON.stringify(json)}`);

  const data = json.data ?? json;
  if (data.status === "conquered_by_me" && data.zoneType === "NORMAL") {
    assert(
      data.normal?.passiveEarning?.progressPercent != null,
      "owned NORMAL zone should include normal.passiveEarning.progressPercent"
    );
    console.log("[OK] Live GET zone — normal.passiveEarning:", data.normal.passiveEarning);
  } else if (data.activeCaptureSession && data.zoneType === "NORMAL") {
    assert(
      data.activeCaptureSession.captureProgressPercent != null,
      "mid-snatch NORMAL should include captureProgressPercent"
    );
    console.log("[OK] Live GET zone — captureProgressPercent:", data.activeCaptureSession.captureProgressPercent);
  } else {
    console.log(
      "[INFO] Live zone is not owned NORMAL with passiveEarning; start a snatch or capture to see new fields."
    );
  }
}

const live = process.argv.includes("--live");
try {
  runUnitTests();
  if (live) {
    await runLiveCheck();
  }
  process.exit(0);
} catch (err) {
  console.error("[FAIL]", err.message);
  process.exit(1);
}

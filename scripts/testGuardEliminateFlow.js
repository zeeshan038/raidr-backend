/**
 * Smoke test: capture session + eliminate-guards + zone GET guardCount sync.
 *
 * Usage:
 *   node scripts/testGuardEliminateFlow.js
 *   API_BASE=https://backend.raidr-app.com node scripts/testGuardEliminateFlow.js
 *   ZONE_ID=... ATTACKER_USER_ID=... node scripts/testGuardEliminateFlow.js
 *   node scripts/testGuardEliminateFlow.js --cancel   # clear Redis capture session for test attacker
 */
import dotenv from "dotenv";
dotenv.config();

import { PrismaClient } from "@prisma/client";
import { generateToken } from "../utils/methods/methods.js";

const prisma = new PrismaClient();
const API_BASE = process.env.API_BASE || "http://localhost:5001/api";
const ZONE_ID = process.env.ZONE_ID || "b5e52d21-fcdd-4281-afec-e2de129ca733";

async function api(method, path, token, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

async function pickAttacker(ownerId) {
  if (process.env.ATTACKER_USER_ID) {
    return prisma.user.findUnique({ where: { id: process.env.ATTACKER_USER_ID } });
  }
  const users = await prisma.user.findMany({
    where: { id: { not: ownerId } },
    take: 30,
    orderBy: { createdAt: "desc" },
  });
  for (const u of users) {
    const owned = await prisma.singlePlayerZone.count({
      where: { currentOwnerId: u.id, isActive: true },
    });
    if (owned < 5) return u;
  }
  return users[0] ?? null;
}

async function main() {
  console.log(`API_BASE=${API_BASE}`);
  console.log(`ZONE_ID=${ZONE_ID}\n`);

  const zone = await prisma.singlePlayerZone.findUnique({ where: { id: ZONE_ID } });
  if (!zone) {
    console.error("Zone not found in DB");
    process.exit(1);
  }

  const attacker = await pickAttacker(zone.currentOwnerId);
  if (!attacker) {
    console.error("No attacker user found");
    process.exit(1);
  }

  const token = generateToken(attacker);
  const lat = zone.latitude;
  const lng = zone.longitude;

  console.log(`Zone: ${zone.name} | DB guardCount=${zone.guardCount} | owner=${zone.currentOwnerId}`);
  console.log(`Attacker: ${attacker.email} (${attacker.id})\n`);

  if (process.argv.includes("--cancel")) {
    const cancel = await api("POST", `/single-player/zones/${ZONE_ID}/capture/cancel`, token);
    console.log(`POST capture/cancel → status=${cancel.status} msg=${cancel.json?.msg || cancel.json?.raw}`);
    await prisma.$disconnect();
    process.exit(cancel.status === 200 ? 0 : 1);
  }

  const health = await fetch(`${API_BASE}/single-player/game-config`, {
    headers: { Authorization: `Bearer ${token}` },
  }).catch((e) => ({ ok: false, status: 0, statusText: e.message }));

  if (!health.ok) {
    console.error(`API not reachable (${health.status || "network"}). Start server or set API_BASE.`);
    process.exit(1);
  }

  let get1 = await api("GET", `/single-player/zones/${ZONE_ID}?latitude=${lat}&longitude=${lng}`, token);
  console.log("1) GET zone (before)");
  console.log(`   status=${get1.status} guardCount=${get1.json?.data?.guardCount} activeCaptureSession=${get1.json?.data?.activeCaptureSession ? "yes" : "null"}`);

  const start = await api("POST", `/single-player/zones/${ZONE_ID}/capture/start`, token, {
    latitude: lat,
    longitude: lng,
  });
  console.log("\n2) POST capture/start");
  console.log(`   status=${start.status} msg=${start.json?.msg || start.json?.raw}`);
  if (start.json?.sessionGuardsRemaining != null) {
    console.log(`   sessionGuardsRemaining=${start.json.sessionGuardsRemaining}`);
  }

  const elim = await api("POST", `/single-player/zones/${ZONE_ID}/capture/eliminate-guards`, token, {
    count: 1,
  });
  console.log("\n3) POST eliminate-guards { count: 1 }");
  console.log(`   status=${elim.status} msg=${elim.json?.msg || elim.json?.raw}`);
  if (elim.json?.data) {
    const d = elim.json.data;
    console.log(
      `   data.guardCount=${d.guardCount} sessionRemaining=${d.sessionGuardsRemaining} deployed=${d.deployedGuardCount} activeSession=${d.activeCaptureSession ? "yes" : "no"}`
    );
  }

  const get2 = await api("GET", `/single-player/zones/${ZONE_ID}?latitude=${lat}&longitude=${lng}`, token);
  console.log("\n4) GET zone (after eliminate)");
  console.log(`   status=${get2.status} guardCount=${get2.json?.data?.guardCount} deployedGuardCount=${get2.json?.data?.deployedGuardCount}`);
  const sess = get2.json?.data?.activeCaptureSession;
  console.log(
    `   activeCaptureSession=${sess ? `remaining=${sess.sessionGuardsRemaining}` : "null"}`
  );

  const restart = await api("POST", `/single-player/zones/${ZONE_ID}/capture/start`, token, {
    latitude: lat,
    longitude: lng,
  });
  console.log("\n5) POST capture/start again (simulate re-open AR)");
  console.log(`   status=${restart.status} msg=${restart.json?.msg} resumed=${restart.json?.resumed}`);
  console.log(`   sessionGuardsRemaining=${restart.json?.sessionGuardsRemaining}`);

  const passElim = elim.status === 200 && elim.json?.data?.guardCount === (zone.guardCount ?? 0) - 1;
  const passGet =
    get2.status === 200 &&
    get2.json?.data?.activeCaptureSession != null &&
    get2.json?.data?.guardCount === elim.json?.data?.guardCount;
  const passRestart =
    restart.status === 200 &&
    restart.json?.resumed === true &&
    restart.json?.sessionGuardsRemaining === elim.json?.data?.sessionGuardsRemaining;

  console.log("\n--- Result ---");
  console.log(passElim ? "PASS eliminate response guardCount" : "FAIL eliminate response (check coins / guards / deploy version)");
  console.log(passGet ? "PASS GET zone synced with session" : "FAIL GET zone (session missing or guardCount mismatch — redeploy latest backend)");
  console.log(
    passRestart
      ? "PASS capture/start resumes session (guards do not reset)"
      : "FAIL capture/start reset guards — deploy latest backend with idempotent start"
  );

  await prisma.$disconnect();
  process.exit(passElim && passGet && passRestart ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

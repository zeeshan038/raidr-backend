/**
 * Live smoke: Sponsored Day (/theme) + Brand Month (/brand-month/active)
 * against the running local API.
 *
 * Usage:
 *   node scripts/testBrandMonthThemeLive.js
 *   API_BASE=http://localhost:5001/api node scripts/testBrandMonthThemeLive.js
 */
import dotenv from "dotenv";
dotenv.config();

import { PrismaClient } from "@prisma/client";
import { generateToken } from "../utils/methods/methods.js";
import { BRAND_MONTH_REWARD_TYPE } from "../utils/brandMonth.js";

const prisma = new PrismaClient();
const API_BASE = process.env.API_BASE || "http://localhost:5001/api";
const TAG = `bm-theme-smoke-${Date.now()}`;

const ISB = { lat: 33.5654785, lng: 73.1501315 };
const TLV = { lat: 32.0853, lng: 34.7818 };

let createdThemeIds = [];
let createdCampaignIds = [];

async function api(path, token) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function cleanup() {
  if (createdCampaignIds.length) {
    await prisma.brandMonthProgress.deleteMany({
      where: { campaignId: { in: createdCampaignIds } },
    });
    await prisma.brandMonthCampaign.deleteMany({
      where: { id: { in: createdCampaignIds } },
    });
  }
  if (createdThemeIds.length) {
    await prisma.sponsoredTheme.deleteMany({
      where: { id: { in: createdThemeIds } },
    });
  }
}

async function main() {
  console.log(`API_BASE=${API_BASE}`);
  console.log(`TAG=${TAG}\n`);

  const user = await prisma.user.findFirst({ orderBy: { createdAt: "desc" } });
  assert(user, "No user in DB to mint a player token");
  const token = generateToken(user);
  console.log(`Player: ${user.email || user.id}`);

  const now = new Date();
  const start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Newer far theme (old bug would prefer this and then return null for ISB players)
  const farTheme = await prisma.sponsoredTheme.create({
    data: {
      name: `${TAG}-tlv`,
      latitude: TLV.lat,
      longitude: TLV.lng,
      radius: 5000,
      isActive: true,
      startDate: start,
      endDate: end,
      zoneImageUrl: "https://example.com/tlv.png",
      mapLogoUrl: "https://example.com/tlv-icon.png",
    },
  });
  createdThemeIds.push(farTheme.id);

  const localTheme = await prisma.sponsoredTheme.create({
    data: {
      name: `${TAG}-isb`,
      latitude: ISB.lat,
      longitude: ISB.lng,
      radius: 5000,
      isActive: true,
      startDate: start,
      endDate: end,
      zoneImageUrl: "https://example.com/isb.png",
      mapLogoUrl: "https://example.com/isb-icon.png",
    },
  });
  createdThemeIds.push(localTheme.id);

  const campaign = await prisma.brandMonthCampaign.create({
    data: {
      name: `${TAG}-campaign`,
      description: "smoke brand month",
      startDate: start,
      endDate: end,
      xpTarget: 100,
      inventoryTotal: 5,
      inventoryRemaining: 5,
      rewardType: BRAND_MONTH_REWARD_TYPE.INLINE,
      rewardTitle: "Smoke reward",
      rewardSponsorName: "Smoke Sponsor",
      sponsoredThemeId: localTheme.id,
      isActive: true,
    },
  });
  createdCampaignIds.push(campaign.id);

  console.log("\n1) /theme with latitude/longitude (Flutter keys) near ISB");
  const themeFlutter = await api(
    `/single-player/theme?latitude=${ISB.lat}&longitude=${ISB.lng}`,
    token
  );
  console.log(`   HTTP ${themeFlutter.status} theme=${themeFlutter.json?.data?.name || null}`);
  assert(themeFlutter.status === 200, "theme flutter coords HTTP != 200");
  assert(
    themeFlutter.json?.data?.id === localTheme.id ||
      themeFlutter.json?.data?.id === campaign.sponsoredThemeId,
    `expected local/ISB theme, got ${themeFlutter.json?.data?.id}`
  );
  assert(
    themeFlutter.json?.data?.id !== farTheme.id,
    "must not return newer far TLV theme for ISB player"
  );

  console.log("2) /theme with lat/lng aliases near ISB");
  const themeShort = await api(
    `/single-player/theme?lat=${ISB.lat}&lng=${ISB.lng}`,
    token
  );
  console.log(`   HTTP ${themeShort.status} theme=${themeShort.json?.data?.name || null}`);
  assert(themeShort.status === 200, "theme lat/lng HTTP != 200");
  assert(themeShort.json?.data?.id, "lat/lng should also return a theme");

  console.log("3) /brand-month/active near ISB");
  const bmIsb = await api(
    `/single-player/brand-month/active?latitude=${ISB.lat}&longitude=${ISB.lng}`,
    token
  );
  console.log(
    `   HTTP ${bmIsb.status} campaign=${bmIsb.json?.data?.name || null} themeId=${bmIsb.json?.data?.sponsoredThemeId || null}`
  );
  assert(bmIsb.status === 200, "brand-month ISB HTTP != 200");
  assert(bmIsb.json?.data?.campaignId === campaign.id, "expected smoke campaign at ISB");

  console.log("4) /brand-month/active far away (TLV) should not see ISB-fenced campaign");
  const bmTlv = await api(
    `/single-player/brand-month/active?latitude=${TLV.lat}&longitude=${TLV.lng}`,
    token
  );
  console.log(`   HTTP ${bmTlv.status} data=${bmTlv.json?.data ? bmTlv.json.data.name : null}`);
  assert(bmTlv.status === 200, "brand-month TLV HTTP != 200");
  assert(
    bmTlv.json?.data?.campaignId !== campaign.id,
    "ISB-fenced campaign must not win at TLV"
  );

  console.log("\n✅ Live smoke passed");
}

main()
  .catch((err) => {
    console.error("\n❌ Live smoke failed:", err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await cleanup();
      console.log("🧹 cleaned smoke rows");
    } catch (e) {
      console.error("cleanup error:", e.message);
    }
    await prisma.$disconnect();
  });

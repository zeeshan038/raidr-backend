import assert from "node:assert/strict";
import test from "node:test";

import {
  parseBrandMonthCoords,
  themeLocationTier,
  pickSponsoredThemeForLocation,
  pickBrandMonthCampaignForLocation,
} from "../utils/brandMonth.js";
import { CreateBrandMonthSchema } from "../schema/Admin/BrandMonth.js";

/** Islamabad-ish pin used in prior Flutter logs */
const ISB = { lat: 33.5654785, lng: 73.1501315 };
/** Far away (Tel Aviv) */
const TLV = { lat: 32.0853, lng: 34.7818 };

const themeNearIsb = {
  id: "theme-isb",
  name: "ISB Sponsored Day",
  latitude: 33.565,
  longitude: 73.15,
  radius: 5000,
  createdAt: new Date("2026-11-01"),
};

const themeNearTlv = {
  id: "theme-tlv",
  name: "TLV Sponsored Day",
  latitude: 32.0853,
  longitude: 34.7818,
  radius: 5000,
  createdAt: new Date("2026-11-20"), // newer — old bug would pick this first
};

const themeWorldwide = {
  id: "theme-world",
  name: "Worldwide Day",
  latitude: null,
  longitude: null,
  radius: null,
  createdAt: new Date("2026-10-01"),
};

test("parseBrandMonthCoords accepts latitude/longitude (Flutter style)", () => {
  assert.deepEqual(
    parseBrandMonthCoords({ latitude: "33.5654785", longitude: "73.1501315" }),
    ISB
  );
});

test("parseBrandMonthCoords accepts lat/lng aliases", () => {
  assert.deepEqual(parseBrandMonthCoords({ lat: 33.1, lng: 73.2 }), {
    lat: 33.1,
    lng: 73.2,
  });
  assert.deepEqual(parseBrandMonthCoords({ lat: 33.1, long: 73.2 }), {
    lat: 33.1,
    lng: 73.2,
  });
});

test("parseBrandMonthCoords returns null when incomplete", () => {
  assert.equal(parseBrandMonthCoords({ latitude: 33.5 }), null);
  assert.equal(parseBrandMonthCoords({}), null);
});

test("geo theme: inside radius → tier 2, outside → -1, missing coords → -1", () => {
  assert.equal(themeLocationTier(themeNearIsb, ISB), 2);
  assert.equal(themeLocationTier(themeNearIsb, TLV), -1);
  assert.equal(themeLocationTier(themeNearIsb, null), -1);
});

test("theme with no pin is worldwide (tier 0)", () => {
  assert.equal(themeLocationTier(themeWorldwide, ISB), 0);
  assert.equal(themeLocationTier(themeWorldwide, null), 0);
});

test("pickSponsoredThemeForLocation prefers local over newer far theme (fixes sponsored day bug)", () => {
  // Newest theme is TLV, but player is in Islamabad — must pick ISB theme
  const picked = pickSponsoredThemeForLocation(
    [themeNearTlv, themeNearIsb],
    ISB
  );
  assert.equal(picked?.id, "theme-isb");
});

test("pickSponsoredThemeForLocation returns null when only far geo themes and player outside all", () => {
  const picked = pickSponsoredThemeForLocation([themeNearTlv], ISB);
  assert.equal(picked, null);
});

test("pickSponsoredThemeForLocation falls back to worldwide when no geo match", () => {
  const picked = pickSponsoredThemeForLocation(
    [themeNearTlv, themeWorldwide],
    ISB
  );
  assert.equal(picked?.id, "theme-world");
});

test("Brand Month without sponsoredTheme is invisible (not worldwide)", () => {
  const campaign = {
    id: "bm-orphan",
    createdAt: new Date("2026-11-01"),
    sponsoredThemeId: null,
    sponsoredTheme: null,
  };
  assert.equal(pickBrandMonthCampaignForLocation([campaign], ISB), null);
});

test("Brand Month with linked local theme shows only inside radius", () => {
  const campaign = {
    id: "bm-isb",
    createdAt: new Date("2026-11-01"),
    sponsoredThemeId: themeNearIsb.id,
    sponsoredTheme: themeNearIsb,
  };
  assert.equal(pickBrandMonthCampaignForLocation([campaign], ISB)?.id, "bm-isb");
  assert.equal(pickBrandMonthCampaignForLocation([campaign], TLV), null);
  assert.equal(pickBrandMonthCampaignForLocation([campaign], null), null);
});

test("regional Brand Month beats worldwide when player is inside fence", () => {
  const regional = {
    id: "bm-regional",
    createdAt: new Date("2026-10-01"),
    sponsoredThemeId: themeNearIsb.id,
    sponsoredTheme: themeNearIsb,
  };
  const worldwide = {
    id: "bm-world",
    createdAt: new Date("2026-11-01"),
    sponsoredThemeId: themeWorldwide.id,
    sponsoredTheme: themeWorldwide,
  };
  assert.equal(
    pickBrandMonthCampaignForLocation([worldwide, regional], ISB)?.id,
    "bm-regional"
  );
});

test("CreateBrandMonthSchema rejects missing sponsoredThemeId", () => {
  const result = CreateBrandMonthSchema({
    name: "Test BM",
    startDate: "2026-11-01T00:00:00.000Z",
    endDate: "2026-12-01T00:00:00.000Z",
    xpTarget: 100,
    inventoryTotal: 10,
    rewardType: "INLINE",
    rewardTitle: "Free pizza",
    rewardSponsorName: "Sun Pizza",
  });
  assert.ok(result.error, "expected validation error");
  assert.match(String(result.error.message), /Sponsored Day Theme|sponsoredThemeId/i);
});

test("CreateBrandMonthSchema accepts valid linked theme", () => {
  const result = CreateBrandMonthSchema({
    name: "Test BM",
    startDate: "2026-11-01T00:00:00.000Z",
    endDate: "2026-12-01T00:00:00.000Z",
    xpTarget: 100,
    inventoryTotal: 10,
    rewardType: "INLINE",
    rewardTitle: "Free pizza",
    rewardSponsorName: "Sun Pizza",
    sponsoredThemeId: "0e5fc324-1427-442c-80bf-e883f1f28342",
  });
  assert.equal(result.error, undefined);
  assert.equal(result.value.sponsoredThemeId, "0e5fc324-1427-442c-80bf-e883f1f28342");
});

/**
 * Mirrors fixed getActiveTheme selection: Brand Month theme first, else location-aware standalone.
 * Ensures latitude/longitude query shape works the same as lat/lng.
 */
test("getActiveTheme-style selection works with latitude/longitude query keys", () => {
  const queryFlutter = { latitude: String(ISB.lat), longitude: String(ISB.lng) };
  const queryShort = { lat: String(ISB.lat), lng: String(ISB.lng) };

  const coordsA = parseBrandMonthCoords(queryFlutter);
  const coordsB = parseBrandMonthCoords(queryShort);
  assert.deepEqual(coordsA, coordsB);

  const campaign = {
    id: "bm-isb",
    createdAt: new Date(),
    sponsoredThemeId: themeNearIsb.id,
    sponsoredTheme: themeNearIsb,
  };

  const fromBrandMonth = pickBrandMonthCampaignForLocation([campaign], coordsA);
  assert.equal(fromBrandMonth?.sponsoredTheme?.id, "theme-isb");

  // Standalone path: newer far theme must not block local theme
  const standalone = pickSponsoredThemeForLocation(
    [themeNearTlv, themeNearIsb],
    coordsA
  );
  assert.equal(standalone?.id, "theme-isb");
});

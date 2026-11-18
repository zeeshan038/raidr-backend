import assert from "node:assert/strict";
import test from "node:test";

import {
  countryLookupValues,
  entitiesAreConfirmedInSameCountry,
  normalizeCountryCode,
  resolvePlayerCountryCodeAsync,
} from "../utils/discoveryCountry.js";
import {
  buildSinglePlayerZoneMapWhere,
  shouldShowSinglePlayerZoneOnMap,
} from "../utils/methods/methods.js";

const noOwner = { currentOwnerId: null };

test("normalizes full country names and ISO-2 codes for country-wide discovery", () => {
  assert.equal(normalizeCountryCode("Pakistan"), "PK");
  assert.equal(normalizeCountryCode("PK"), "PK");
  assert.equal(normalizeCountryCode("Israel"), "IL");
  assert.equal(normalizeCountryCode("IL"), "IL");
  assert.equal(normalizeCountryCode("France"), "FR");
  assert.ok(countryLookupValues("PK").includes("PAKISTAN"));
  assert.ok(countryLookupValues("IL").includes("ISRAEL"));
});

test("resolves country from the mobile app's existing GPS without countryCode", async () => {
  const originalApiKey = process.env.GOOGLE_PLACES_API_KEY;
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  process.env.GOOGLE_PLACES_API_KEY = "test-key";
  globalThis.fetch = async (url) => {
    requestedUrl = String(url);
    return {
      json: async () => ({
        status: "OK",
        results: [
          {
            address_components: [
              { short_name: "PK", long_name: "Pakistan", types: ["country"] },
            ],
          },
        ],
      }),
    };
  };

  try {
    const country = await resolvePlayerCountryCodeAsync(
      { query: {}, user: { id: "mobile-gps-test-user" } },
      { lat: 31.5204, lng: 74.3587 }
    );
    assert.equal(country, "PK");
    assert.match(requestedUrl, /latlng=31\.5204%2C74\.3587/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) {
      delete process.env.GOOGLE_PLACES_API_KEY;
    } else {
      process.env.GOOGLE_PLACES_API_KEY = originalApiKey;
    }
  }
});

test("a Karachi zone is visible in Lahore even though it is well beyond 150 km", () => {
  const visible = shouldShowSinglePlayerZoneOnMap(
    {
      ...noOwner,
      country: "Pakistan",
      latitude: 24.8607,
      longitude: 67.0011,
    },
    {
      coords: { lat: 31.5204, lng: 74.3587 },
      radiusMeters: 100_000,
      playerCountryCode: "PK",
    }
  );

  assert.equal(visible, true);
});

test("a Tel Aviv zone is visible in Eilat even though it is beyond the 150 km cap", () => {
  const visible = shouldShowSinglePlayerZoneOnMap(
    {
      ...noOwner,
      country: "Israel",
      latitude: 32.0853,
      longitude: 34.7818,
    },
    {
      coords: { lat: 29.5577, lng: 34.9519 },
      radiusMeters: 100_000,
      playerCountryCode: "IL",
    }
  );

  assert.equal(visible, true);
});

test("a zone from another confirmed country stays hidden even inside the local radius", () => {
  const visible = shouldShowSinglePlayerZoneOnMap(
    {
      ...noOwner,
      country: "India",
      latitude: 31.6339,
      longitude: 74.8723,
    },
    {
      coords: { lat: 31.5204, lng: 74.3587 },
      radiusMeters: 150_000,
      playerCountryCode: "PK",
    }
  );

  assert.equal(visible, false);
  assert.equal(
    entitiesAreConfirmedInSameCountry("PK", {
      country: "India",
      latitude: 31.6339,
      longitude: 74.8723,
    }),
    false
  );
});

test("the database candidate query includes the full player country, not just a 150 km box", () => {
  const where = buildSinglePlayerZoneMapWhere({
    userId: "user-1",
    coords: { lat: 31.5204, lng: 74.3587 },
    radiusMeters: 150_000,
    playerCountryCode: "PK",
  });
  const serialized = JSON.stringify(where);

  assert.match(serialized, /PAKISTAN/);
  assert.match(serialized, /"latitude"/);
  assert.match(serialized, /"currentOwnerId":"user-1"/);
});

test("legacy zones without usable country metadata retain a local-only fallback", () => {
  const nearby = shouldShowSinglePlayerZoneOnMap(
    { ...noOwner, country: null, latitude: 48.8566, longitude: 2.3522 },
    {
      coords: { lat: 48.9, lng: 2.35 },
      radiusMeters: 100_000,
      playerCountryCode: null,
    }
  );
  const distant = shouldShowSinglePlayerZoneOnMap(
    { ...noOwner, country: null, latitude: 48.8566, longitude: 2.3522 },
    {
      coords: { lat: 50.8503, lng: 4.3517 },
      radiusMeters: 100_000,
      playerCountryCode: null,
    }
  );

  assert.equal(nearby, true);
  assert.equal(distant, false);
});

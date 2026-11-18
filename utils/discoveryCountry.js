/**
 * Map discovery country hints (zone.country, coarse lat/lng).
 * Event discovery can optionally be limited by DISCOVERY_SAME_COUNTRY_ONLY.
 * Single-player zones always use an explicit same-country check in methods.js.
 */

const COUNTRY_ALIASES = {
  PK: "PK",
  PAK: "PK",
  PAKISTAN: "PK",
  IN: "IN",
  IND: "IN",
  INDIA: "IN",
  US: "US",
  USA: "US",
  "UNITED STATES": "US",
  FI: "FI",
  FIN: "FI",
  FINLAND: "FI",
  AE: "AE",
  UAE: "AE",
  "UNITED ARAB EMIRATES": "AE",
  GB: "GB",
  UK: "GB",
  "UNITED KINGDOM": "GB",
  SA: "SA",
  "SAUDI ARABIA": "SA",
  IL: "IL",
  ISR: "IL",
  ISRAEL: "IL",
};

const countryKey = (value) =>
  String(value)
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/*
 * The admin/merchant dashboards may send a full country name while mobile sends
 * ISO-3166 alpha-2. Populate the aliases available from Node's built-in Intl
 * data so this works for countries beyond the hand-written aliases above.
 */
let regionDisplayNames = null;
try {
  regionDisplayNames = new Intl.DisplayNames(["en"], { type: "region" });
  for (let first = 65; first <= 90; first += 1) {
    for (let second = 65; second <= 90; second += 1) {
      const code = String.fromCharCode(first, second);
      const name = regionDisplayNames.of(code);
      if (name && name !== code && name !== "Unknown Region") {
        COUNTRY_ALIASES[countryKey(name)] ??= code;
      }
    }
  }
} catch {
  // Older Node builds can still use the explicit aliases and ISO-2 codes.
}

/** Rough mainland bounding boxes (not legal borders — used only when DB country is empty). */
const REGION_BOXES = [
  { code: "PK", minLat: 23.5, maxLat: 37.15, minLng: 60.5, maxLng: 77.85 },
  { code: "IN", minLat: 6.0, maxLat: 35.75, minLng: 68.0, maxLng: 97.6 },
  { code: "AE", minLat: 22.5, maxLat: 26.5, minLng: 51.0, maxLng: 56.5 },
  { code: "SA", minLat: 16.0, maxLat: 32.5, minLng: 34.0, maxLng: 56.0 },
  { code: "FI", minLat: 59.5, maxLat: 70.5, minLng: 19.0, maxLng: 32.0 },
  { code: "US", minLat: 24.0, maxLat: 49.5, minLng: -125.0, maxLng: -66.0 },
  { code: "GB", minLat: 49.5, maxLat: 61.0, minLng: -8.5, maxLng: 2.0 },
  { code: "IL", minLat: 29.45, maxLat: 33.35, minLng: 34.2, maxLng: 35.95 },
];

export const normalizeCountryCode = (value) => {
  if (value == null) return null;
  const key = countryKey(value);
  if (!key) return null;
  if (COUNTRY_ALIASES[key]) return COUNTRY_ALIASES[key];
  if (/^[A-Z]{2}$/.test(key)) return key;
  return null;
};

/**
 * Values that can exist in the legacy `country` column for one ISO country.
 * Used to retrieve all in-country zones before the final country check.
 */
export const countryLookupValues = (value) => {
  const code = normalizeCountryCode(value);
  if (!code) return [];

  const values = new Set([code]);
  for (const [alias, aliasCode] of Object.entries(COUNTRY_ALIASES)) {
    if (aliasCode === code) values.add(alias);
  }
  const displayName = regionDisplayNames?.of(code);
  if (displayName && displayName !== code) values.add(displayName);
  return [...values];
};

/**
 * Coarse country from coordinates. Overlapping boxes (PK/IN border): lng west of ~74 → PK.
 */
export const inferCountryCodeFromCoordinates = (lat, lng) => {
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return null;

  const hits = REGION_BOXES.filter(
    (r) => la >= r.minLat && la <= r.maxLat && ln >= r.minLng && ln <= r.maxLng
  );
  if (hits.length === 0) return null;
  if (hits.length === 1) return hits[0].code;

  const codes = new Set(hits.map((h) => h.code));
  if (codes.has("PK") && codes.has("IN")) {
    return ln < 74 ? "PK" : "IN";
  }
  return hits[0].code;
};

export const resolvePlayerCountryCode = (req, coords) => {
  const fromQuery =
    req?.query?.countryCode ??
    req?.query?.country ??
    req?.query?.playerCountry;
  const normalized = normalizeCountryCode(fromQuery);
  if (normalized) return normalized;
  if (coords?.lat != null && coords?.lng != null) {
    return inferCountryCodeFromCoordinates(coords.lat, coords.lng);
  }
  return null;
};

const playerCountryCache = new Map();
let geocodingRetryAfter = 0;

const readCachedPlayerCountry = (key) => {
  const cached = playerCountryCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    playerCountryCache.delete(key);
    return null;
  }
  return cached.code;
};

const cachePlayerCountry = (key, code) => {
  if (playerCountryCache.size >= 5_000) {
    const oldestKey = playerCountryCache.keys().next().value;
    if (oldestKey) playerCountryCache.delete(oldestKey);
  }
  playerCountryCache.set(key, {
    code,
    expiresAt: Date.now() + 30 * 60 * 1000,
  });
};

/**
 * Backward-compatible country resolution for the production mobile app.
 * The app only needs to keep sending its existing latitude/longitude values.
 * If countryCode is absent, the backend reverse-geocodes GPS with the already
 * configured Google key, caches the result, then falls back to coarse boxes.
 */
export const resolvePlayerCountryCodeAsync = async (req, coords) => {
  const explicit = normalizeCountryCode(
    req?.query?.countryCode ?? req?.query?.country ?? req?.query?.playerCountry
  );
  if (explicit) return explicit;

  const lat = Number(coords?.lat);
  const lng = Number(coords?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const cacheKey = req?.user?.id
    ? `user:${req.user.id}:${lat.toFixed(2)},${lng.toFixed(2)}`
    : `gps:${lat.toFixed(3)},${lng.toFixed(3)}`;
  const cached = readCachedPlayerCountry(cacheKey);
  if (cached) return cached;

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (apiKey && Date.now() >= geocodingRetryAfter) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2_500);
    try {
      const url =
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${encodeURIComponent(`${lat},${lng}`)}` +
        `&result_type=country&key=${encodeURIComponent(apiKey)}`;
      const response = await fetch(url, { signal: controller.signal });
      const data = await response.json();
      const countryComponent = data?.results
        ?.flatMap((result) => result.address_components ?? [])
        .find((component) => component.types?.includes("country"));
      const code = normalizeCountryCode(
        countryComponent?.short_name ?? countryComponent?.long_name
      );
      if (code) {
        cachePlayerCountry(cacheKey, code);
        return code;
      }

      // Avoid repeatedly calling an API that is disabled or rejected.
      if (data?.status && !["OK", "ZERO_RESULTS"].includes(data.status)) {
        geocodingRetryAfter = Date.now() + 5 * 60 * 1000;
      }
    } catch {
      geocodingRetryAfter = Date.now() + 30 * 1000;
    } finally {
      clearTimeout(timeout);
    }
  }

  return inferCountryCodeFromCoordinates(lat, lng);
};

export const entityCountryCode = ({ country, latitude, longitude }) => {
  const fromDb = normalizeCountryCode(country);
  if (fromDb) return fromDb;
  if (latitude != null && longitude != null) {
    return inferCountryCodeFromCoordinates(
      parseFloat(latitude),
      parseFloat(longitude)
    );
  }
  return null;
};

const discoveryRequiresSameCountry = () => {
  const v = process.env.DISCOVERY_SAME_COUNTRY_ONLY;
  if (v == null || String(v).trim() === "") return false;
  const s = String(v).trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes";
};

/**
 * When DISCOVERY_SAME_COUNTRY_ONLY=true and both sides resolve, they must match.
 * Default: allow cross-country; distance radius still limits the map.
 */
export const isSameCountryForDiscovery = (playerCountryCode, entity) => {
  if (!discoveryRequiresSameCountry()) return true;
  const player = normalizeCountryCode(playerCountryCode);
  const entityCode = entityCountryCode(entity);
  if (!player || !entityCode) return true;
  return player === entityCode;
};

/** Both resolved and equal — used for wider in-country radius (e.g. Swabi ↔ Peshawar). */
export const entitiesShareCountryForDiscovery = (playerCountryCode, entity) => {
  const player = normalizeCountryCode(playerCountryCode);
  const entityCode = entityCountryCode(entity);
  if (!player || !entityCode) return true;
  return player === entityCode;
};

/** Both countries must be known and equal. This is used for country-wide zone visibility. */
export const entitiesAreConfirmedInSameCountry = (playerCountryCode, entity) => {
  const player = normalizeCountryCode(playerCountryCode);
  const entityCode = entityCountryCode(entity);
  return Boolean(player && entityCode && player === entityCode);
};

/** Regional discovery within one country (km). Env DISCOVERY_SAME_COUNTRY_RADIUS_KM, default 120. */
export const getSameCountryDiscoveryRadiusKm = () => {
  const km = parseFloat(process.env.DISCOVERY_SAME_COUNTRY_RADIUS_KM);
  if (Number.isFinite(km) && km > 0) return km;
  return 120;
};

/**
 * Per-pin radius: local nearby radius, or wider when player + entity share a country.
 * @param {number} localRadiusMeters from getDiscoveryRadiusMeters
 * @param {number} maxMeters hard cap (DISCOVERY_RADIUS_MAX_KM)
 */
export const discoveryRadiusMetersForEntity = (
  playerCountryCode,
  entity,
  localRadiusMeters,
  maxMeters
) => {
  const cap = Math.max(localRadiusMeters, maxMeters > 0 ? maxMeters : localRadiusMeters);
  if (!entitiesShareCountryForDiscovery(playerCountryCode, entity)) {
    return Math.min(localRadiusMeters, cap);
  }
  const regional = getSameCountryDiscoveryRadiusKm() * 1000;
  return Math.min(Math.max(localRadiusMeters, regional), cap);
};

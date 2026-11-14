/**
 * Map discovery: same-country visibility (e.g. PK zones hidden in IN).
 * Prefer zone.country from DB; fallback to coarse lat/lng regions when missing.
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
};

/** Rough mainland bounding boxes (not legal borders — used only when DB country is empty). */
const REGION_BOXES = [
  { code: "PK", minLat: 23.5, maxLat: 37.15, minLng: 60.5, maxLng: 77.85 },
  { code: "IN", minLat: 6.0, maxLat: 35.75, minLng: 68.0, maxLng: 97.6 },
  { code: "AE", minLat: 22.5, maxLat: 26.5, minLng: 51.0, maxLng: 56.5 },
  { code: "SA", minLat: 16.0, maxLat: 32.5, minLng: 34.0, maxLng: 56.0 },
  { code: "FI", minLat: 59.5, maxLat: 70.5, minLng: 19.0, maxLng: 32.0 },
  { code: "US", minLat: 24.0, maxLat: 49.5, minLng: -125.0, maxLng: -66.0 },
  { code: "GB", minLat: 49.5, maxLat: 61.0, minLng: -8.5, maxLng: 2.0 },
];

export const normalizeCountryCode = (value) => {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const upper = raw.toUpperCase();
  if (COUNTRY_ALIASES[upper]) return COUNTRY_ALIASES[upper];
  if (/^[A-Z]{2}$/.test(upper)) return upper;
  const slug = upper.replace(/[^A-Z\s]/g, " ").replace(/\s+/g, " ").trim();
  return COUNTRY_ALIASES[slug] ?? null;
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

/**
 * When both sides resolve to a country, they must match. Unknown → allow (distance filter only).
 */
export const isSameCountryForDiscovery = (playerCountryCode, entity) => {
  const player = normalizeCountryCode(playerCountryCode);
  const entityCode = entityCountryCode(entity);
  if (!player || !entityCode) return true;
  return player === entityCode;
};
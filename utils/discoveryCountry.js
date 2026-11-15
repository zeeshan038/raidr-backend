/**
 * Map discovery country hints (zone.country, coarse lat/lng).
 * Filtering: only when DISCOVERY_SAME_COUNTRY_ONLY=true (default off = cross-country OK within radius).
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
import jwt from "jsonwebtoken";
import { prisma } from "../../config/db.js";
import {
    countryLookupValues,
    discoveryRadiusMetersForEntity,
    entitiesAreConfirmedInSameCountry,
    entityCountryCode,
    getSameCountryDiscoveryRadiusKm,
    isSameCountryForDiscovery,
    normalizeCountryCode,
    resolvePlayerCountryCode,
} from "../discoveryCountry.js";

export const generateToken = (user) => {
    return jwt.sign({ user }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

export const generateOTP = async () => {
    const OTP = Math.floor(100000 + Math.random() * 900000);
    return OTP.toString();
};

export function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; 
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; 
}


export const generateDynamicXP = (isSurprise) => {
    if (isSurprise) {
        return Math.floor(Math.random() * (100 - 40 + 1)) + 40;
    } else {
        return Math.floor(Math.random() * (60 - 20 + 1)) + 20;
    }
};

export const calculateRadiusForUserLiveEvent = (users, eventLat, eventLng, radiusKm = 20) => {
    return users.filter(user => {
        if (!user.lat || !user.long) return false;
        
        const userLat = parseFloat(user.lat);
        const userLng = parseFloat(user.long);
        
        if (isNaN(userLat) || isNaN(userLng)) return false;

        const distanceMeters = haversineDistance(eventLat, eventLng, userLat, userLng);
        return distanceMeters <= (radiusKm * 1000);
    });
};


export const isPointInPolygon = (lat, lng, polygon) => {
    let isInside = false;
    const x = lat;
    const y = lng;
    
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].lat;
        const yi = polygon[i].lng;
        const xj = polygon[j].lat;
        const yj = polygon[j].lng;
        
        const intersect = ((yi > y) !== (yj > y))
            && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) isInside = !isInside;
    }
    
    return isInside;
};

export const fetchGroundPolygon = async (lat, lng, searchRadiusMeters = 100) => {
    const query = `
    [out:json][timeout:10];
    (
      way(around:${searchRadiusMeters}, ${lat}, ${lng})[leisure~"park|playground|pitch|sports_centre|common|garden|recreation_ground"];
      relation(around:${searchRadiusMeters}, ${lat}, ${lng})[leisure~"park|playground|pitch|sports_centre|common|garden|recreation_ground"];
      way(around:${searchRadiusMeters}, ${lat}, ${lng})[landuse~"recreation_ground|grass|meadow|forest|orchard|vineyard|greenfield|cemetery"];
      relation(around:${searchRadiusMeters}, ${lat}, ${lng})[landuse~"recreation_ground|grass|meadow|forest|orchard|vineyard|greenfield|cemetery"];
      way(around:${searchRadiusMeters}, ${lat}, ${lng})[amenity~"university|school|college|hospital|grave_yard"];
      relation(around:${searchRadiusMeters}, ${lat}, ${lng})[amenity~"university|school|college|hospital|grave_yard"];
    );
    out geom;
    `;
    const url = 'https://overpass-api.de/api/interpreter';
    try {
        const res = await fetch(url, {
            method: 'POST',
            body: `data=${encodeURIComponent(query)}`,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        if (!res.ok) return null;
        const data = await res.json();
        if (!data || !data.elements || data.elements.length === 0) return null;
        
        // Return way containing geometry
        const way = data.elements.find(el => el.type === 'way' && el.geometry && el.geometry.length > 2);
        if (way) {
            return way.geometry.map(pt => ({ lat: pt.lat, lng: pt.lon }));
        }
        return null;
    } catch (err) {
        console.error("[Overpass] Error fetching boundary polygon:", err);
        return null;
    }
};

// Helper to generate random coordinates within a polygon or fall back to a safer circular radius
export const generateRandomCoordinates = async (centerLat, centerLng, radiusMeter, count) => {
    const checkpoints = [];
    const R = 6378137; // Earth radius in meters

    // 1. Try to fetch park/ground boundaries
    const polygon = await fetchGroundPolygon(centerLat, centerLng, radiusMeter);

    if (polygon && polygon.length > 2) {
        let minLat = Infinity, maxLat = -Infinity;
        let minLng = Infinity, maxLng = -Infinity;
        for (const pt of polygon) {
            if (pt.lat < minLat) minLat = pt.lat;
            if (pt.lat > maxLat) maxLat = pt.lat;
            if (pt.lng < minLng) minLng = pt.lng;
            if (pt.lng > maxLng) maxLng = pt.lng;
        }

        let attempts = 0;
        const maxAttempts = count * 200;
        
        while (checkpoints.length < count && attempts < maxAttempts) {
            attempts++;
            const checkpointLat = minLat + Math.random() * (maxLat - minLat);
            const checkpointLng = minLng + Math.random() * (maxLng - minLng);

            if (isPointInPolygon(checkpointLat, checkpointLng, polygon)) {
                checkpoints.push({
                    sequence: checkpoints.length + 1,
                    latitude: checkpointLat,
                    longitude: checkpointLng,
                    description: `Checkpoint ${checkpoints.length + 1}`
                });
            }
        }
    }

    // 2. Fallback: generate points inside a tight circular radius (70% of requested) to prevent overflow
    if (checkpoints.length < count) {
        checkpoints.length = 0;
        const safeRadius = radiusMeter * 0.7;

        for (let i = 1; i <= count; i++) {
            const r = Math.random() * safeRadius;
            const theta = Math.random() * 2 * Math.PI;

            const dLat = (r * Math.cos(theta)) / R;
            const dLng = (r * Math.sin(theta)) / (R * Math.cos((centerLat * Math.PI) / 180));

            const checkpointLat = centerLat + dLat * (180 / Math.PI);
            const checkpointLng = centerLng + dLng * (180 / Math.PI);

            checkpoints.push({
                sequence: i,
                latitude: checkpointLat,
                longitude: checkpointLng,
                description: `Checkpoint ${i}`
            });
        }
    }
    
    return checkpoints;
};

function parseCoordinatePair(latRaw, lngRaw) {
    if (latRaw == null || lngRaw == null || latRaw === "" || lngRaw === "") {
        return null;
    }
    const lat = parseFloat(latRaw);
    const lng = parseFloat(lngRaw);
    if (isNaN(lat) || isNaN(lng)) {
        return null;
    }
    return { lat, lng };
}

/** GPS from request query (supports common param names used by mobile / map). */
export const resolveRequestCoordinatesFromQuery = (req) => {
    const qLat =
        req.query?.lat ??
        req.query?.latitude ??
        req.query?.userLat;
    const qLng =
        req.query?.long ??
        req.query?.lng ??
        req.query?.longitude ??
        req.query?.userLng;

    return parseCoordinatePair(qLat, qLng);
};

/** Prefer live map GPS from query; fall back to stored user profile location. */
export const resolveRequestCoordinates = (req) => {
    const fromQuery = resolveRequestCoordinatesFromQuery(req);
    if (fromQuery) {
        return fromQuery;
    }

    if (req.user?.lat != null && req.user?.long != null) {
        const lat = parseFloat(req.user.lat);
        const lng = parseFloat(req.user.long);
        if (!isNaN(lat) && !isNaN(lng)) {
            return { lat, lng };
        }
    }

    return null;
};

/**
 * Map / zone discovery: use ONLY live GPS from the request (never stale profile),
 * so users do not see "nearby" zones from another city they visited before.
 */
export const resolveMapCoordinates = (req) => resolveRequestCoordinatesFromQuery(req);

/**
 * Prisma WHERE fragment: events near coords OR events the user participates in (controlled zones).
 */
export const buildDiscoveryProximityWhere = ({
    userId,
    coords,
    radiusMeters,
    latField = "latitude",
    lngField = "longitude",
}) => {
    const controlled = { participants: { some: { userId } } };

    if (!coords || !userId) {
        return {};
    }

    const { lat, lng } = coords;
    const latDelta = radiusMeters / 111320;
    const lngDelta = radiusMeters / (111320 * Math.cos((lat * Math.PI) / 180) || 1);

    return {
        OR: [
            controlled,
            {
                AND: [
                    { [latField]: { gte: lat - latDelta, lte: lat + latDelta } },
                    { [lngField]: { gte: lng - lngDelta, lte: lng + lngDelta } },
                ],
            },
        ],
    };
};

/** User actively joined or has in-progress capture (coin rush checkpoints). */
export const userControlsDiscoveryZone = (event) => {
    if (event.isJoined) {
        return true;
    }
    if (event.inProgress) {
        return true;
    }
    if (Array.isArray(event.progress) && event.progress.length > 0) {
        return true;
    }
    return false;
};

/** Keep profile location in sync when the client sends live GPS on map calls. */
export const syncUserLocationFromRequest = (req) => {
    const coords = resolveRequestCoordinatesFromQuery(req);
    const userId = req.user?.id;
    if (!coords || !userId) {
        return;
    }
    prisma.user
        .update({
            where: { id: userId },
            data: {
                lat: String(coords.lat),
                long: String(coords.lng),
            },
        })
        .catch(() => {});
};

/** Hard cap so clients cannot request continent-scale discovery (e.g. radiusKm=500). */
export const getDiscoveryRadiusMaxMeters = () => {
    const maxKm = parseFloat(process.env.DISCOVERY_RADIUS_MAX_KM);
    if (!isNaN(maxKm) && maxKm > 0) {
        return maxKm * 1000;
    }
    return 120 * 1000;
};

const clampDiscoveryRadiusMeters = (meters) =>
    Math.min(Math.max(meters, 1000), getDiscoveryRadiusMaxMeters());

/** Default ~city-scale discovery; override with query radiusKm or DISCOVERY_RADIUS_KM env (capped). */
export const getDiscoveryRadiusMeters = (req) => {
    const fromQuery = parseFloat(req.query?.radiusKm);
    if (!isNaN(fromQuery) && fromQuery > 0) {
        return clampDiscoveryRadiusMeters(fromQuery * 1000);
    }

    const hasCityContext = Boolean(req.query?.city && String(req.query.city).trim());
    if (hasCityContext) {
        const cityRadius = parseFloat(process.env.DISCOVERY_CITY_RADIUS_KM);
        if (!isNaN(cityRadius) && cityRadius > 0) {
            return clampDiscoveryRadiusMeters(cityRadius * 1000);
        }
        return clampDiscoveryRadiusMeters(80 * 1000);
    }

    const fromEnv = parseFloat(process.env.DISCOVERY_RADIUS_KM);
    if (!isNaN(fromEnv) && fromEnv > 0) {
        return clampDiscoveryRadiusMeters(fromEnv * 1000);
    }
    return clampDiscoveryRadiusMeters(50 * 1000);
};

/** Radius for Prisma bbox / dashboard fetch — includes regional same-country pins. */
export const getDiscoveryFetchRadiusMeters = (req, coords, playerCountryCode = null) => {
    const local = getDiscoveryRadiusMeters(req);
    const max = getDiscoveryRadiusMaxMeters();
    const pc =
        playerCountryCode ??
        (coords ? resolvePlayerCountryCode(req, coords) : null);
    if (!pc) return Math.min(local, max);
    const regional = Math.min(getSameCountryDiscoveryRadiusKm() * 1000, max);
    return Math.min(Math.max(local, regional), max);
};

/**
 * Show map zone when within radius of live GPS, or when alwaysShow (user controls the zone).
 * Distance-only — no address/city text matching (that incorrectly showed other cities).
 */
export const shouldShowInDiscovery = ({
    userLat,
    userLng,
    eventLat,
    eventLng,
    radiusMeters,
    alwaysShow = false,
    playerCountryCode = null,
    entityCountry = null,
}) => {
    if (alwaysShow) {
        return true;
    }

    if (userLat == null || userLng == null) {
        return false;
    }

    if (
        eventLat == null || eventLng == null ||
        eventLat === undefined || eventLng === undefined ||
        isNaN(parseFloat(eventLat)) || isNaN(parseFloat(eventLng))
    ) {
        return false;
    }

    if (
        !isSameCountryForDiscovery(playerCountryCode, {
            country: entityCountry,
            latitude: eventLat,
            longitude: eventLng,
        })
    ) {
        return false;
    }

    const dist = haversineDistance(userLat, userLng, parseFloat(eventLat), parseFloat(eventLng));
    const maxMeters = getDiscoveryRadiusMaxMeters();
    const effectiveRadius = discoveryRadiusMetersForEntity(
        playerCountryCode,
        { country: entityCountry, latitude: eventLat, longitude: eventLng },
        radiusMeters,
        maxMeters
    );
    return dist <= effectiveRadius;
};

/** @deprecated Use shouldShowInDiscovery with getDiscoveryRadiusMeters instead */
export const isSameCountryOrClose = (lat1, lon1, lat2, lon2) => {
    const radiusMeters = (parseFloat(process.env.DISCOVERY_RADIUS_KM) || 50) * 1000;
    return shouldShowInDiscovery({
        userLat: lat1,
        userLng: lon1,
        eventLat: lat2,
        eventLng: lon2,
        radiusMeters,
        alwaysShow: false
    });
};

/** Single-player raid zone: user is the current owner (Phase 2 — ownership persists after shield). */
export const userControlsSinglePlayerZone = (zone, userId) => {
    if (!userId || !zone?.currentOwnerId || zone.currentOwnerId !== userId) {
        return false;
    }
    return true;
};

/**
 * Map visibility for SinglePlayerZone: every zone in the player's confirmed
 * country is visible. The local-radius fallback only protects legacy zones
 * with no usable country metadata.
 */
export const shouldShowSinglePlayerZoneOnMap = (
    zone,
    { coords, radiusMeters, userId, now = new Date(), playerCountryCode = null }
) => {
    if (userControlsSinglePlayerZone(zone, userId, now)) {
        return true;
    }

    if (!coords) {
        return false;
    }

    const entity = {
        country: zone.country,
        latitude: zone.latitude,
        longitude: zone.longitude,
    };

    if (entitiesAreConfirmedInSameCountry(playerCountryCode, entity)) {
        return true;
    }

    // If both sides have a country identity, this is definitely another country.
    // Do not let a large local radius leak a zone across a border.
    if (normalizeCountryCode(playerCountryCode) && entityCountryCode(entity)) {
        return false;
    }

    const dist = haversineDistance(
        coords.lat,
        coords.lng,
        parseFloat(zone.latitude),
        parseFloat(zone.longitude)
    );

    const maxMeters = getDiscoveryRadiusMaxMeters();
    return dist <= Math.min(radiusMeters, maxMeters);
};

/**
 * Candidate zones for map discovery. A country condition is included alongside
 * the local bounding box, so a Karachi zone can be returned to a user anywhere
 * in Pakistan without fetching zones from every country.
 */
export const buildSinglePlayerZoneMapWhere = ({
    userId,
    coords,
    radiusMeters,
    playerCountryCode = null,
    now = new Date(),
}) => {
    const controlledByUser =
        userId ?
            {
                currentOwnerId: userId,
            }
            : null;

    if (!coords) {
        return controlledByUser ? { isActive: true, ...controlledByUser } : { isActive: true, id: { in: [] } };
    }

    const { lat, lng } = coords;
    const latDelta = radiusMeters / 111320;
    const lngDelta = radiusMeters / (111320 * Math.cos((lat * Math.PI) / 180) || 1);

    const inBoundingBox = {
        AND: [
            { latitude: { gte: lat - latDelta, lte: lat + latDelta } },
            { longitude: { gte: lng - lngDelta, lte: lng + lngDelta } },
        ],
    };

    const countryValues = countryLookupValues(playerCountryCode);
    const inPlayerCountry =
        countryValues.length > 0
            ? {
                OR: countryValues.map((country) => ({
                    country: { equals: country, mode: "insensitive" },
                })),
            }
            : null;

    return {
        isActive: true,
        OR: [
            ...(controlledByUser ? [controlledByUser] : []),
            inBoundingBox,
            ...(inPlayerCountry ? [inPlayerCountry] : []),
        ],
    };
};

/** Combine Prisma where fragments without clobbering nested OR clauses. */
export const mergeDiscoveryWhere = (...clauses) => {
    const parts = clauses.filter(
        (c) => c && typeof c === "object" && Object.keys(c).length > 0
    );
    if (parts.length === 0) {
        return {};
    }
    if (parts.length === 1) {
        return parts[0];
    }
    return { AND: parts };
};

/**
 * Discovery list status filter; includes time window when cron has not flipped status yet.
 */
/** LiveEvent.endTime is required; CoinRushEvent.endTime is optional. */
const discoveryLiveStatusRow = (now, allowNullEndTime) => {
    const base = { status: "live" };
    if (allowNullEndTime) {
        return {
            AND: [base, { OR: [{ endTime: { gt: now } }, { endTime: null }] }],
        };
    }
    return { ...base, endTime: { gt: now } };
};

const discoveryScheduledInProgressRow = (now, allowNullEndTime) => {
    const base = { status: "scheduled", startTime: { lte: now } };
    if (allowNullEndTime) {
        return {
            AND: [base, { OR: [{ endTime: { gt: now } }, { endTime: null }] }],
        };
    }
    return { ...base, endTime: { gt: now } };
};

export const hasDiscoveryMapCoordinates = (lat, lng) => {
    if (lat == null || lng == null) {
        return false;
    }
    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);
    return !isNaN(parsedLat) && !isNaN(parsedLng);
};

/** Map pin for coin rush: center, else first checkpoint with GPS. */
export const resolveCoinRushDiscoveryLatLng = (event) => {
    if (hasDiscoveryMapCoordinates(event?.centerLat, event?.centerLng)) {
        return { lat: event.centerLat, lng: event.centerLng };
    }
    const checkpoints = event?.checkpoints;
    if (Array.isArray(checkpoints)) {
        for (const cp of checkpoints) {
            if (hasDiscoveryMapCoordinates(cp?.latitude, cp?.longitude)) {
                return { lat: cp.latitude, lng: cp.longitude };
            }
        }
    }
    return { lat: null, lng: null };
};

export const buildDiscoveryStatusWhere = (
    status,
    now = new Date(),
    { allowNullEndTime = false } = {}
) => {
    const normalized = String(status || "").toLowerCase();

    if (normalized === "live") {
        return {
            OR: [
                discoveryLiveStatusRow(now, allowNullEndTime),
                discoveryScheduledInProgressRow(now, allowNullEndTime),
            ],
        };
    }
    if (normalized === "scheduled") {
        return {
            status: "scheduled",
            startTime: { gt: now },
        };
    }
    if (normalized === "ended") {
        return { status: { in: ["completed", "cancelled"] } };
    }
    if (normalized === "joined") {
        return { status: { in: ["live", "scheduled"] } };
    }
    return { status: { in: ["live", "scheduled"] } };
};

export const applyDiscoveryLocationFilter = (events, req, { getLatLng, getAlwaysShow }) => {
    const coords = resolveRequestCoordinates(req);
    const radiusMeters = getDiscoveryRadiusMeters(req);
    const playerCountryCode = resolvePlayerCountryCode(req, coords);

    const filtered = events.filter((event) => {
        if (getAlwaysShow(event)) {
            return true;
        }

        const { lat: eventLat, lng: eventLng } = getLatLng(event);
        // QR / hybrid coin rush with no GPS pin still belongs in the events list.
        if (!hasDiscoveryMapCoordinates(eventLat, eventLng)) {
            return true;
        }

        if (!coords) {
            return false;
        }

        return shouldShowInDiscovery({
            userLat: coords.lat,
            userLng: coords.lng,
            eventLat,
            eventLng,
            radiusMeters,
            alwaysShow: false,
            playerCountryCode,
            entityCountry: event.country ?? null,
        });
    });

    return filtered.map((event) => {
        const { lat: eventLat, lng: eventLng } = getLatLng(event);
        const distance =
            coords &&
            eventLat != null && eventLng != null &&
            eventLat !== undefined && eventLng !== undefined
                ? haversineDistance(coords.lat, coords.lng, parseFloat(eventLat), parseFloat(eventLng))
                : null;
        return {
            ...event,
            distance: distance != null ? distance : undefined
        };
    }).sort((a, b) => {
        const distA = a.distance != null ? a.distance : Infinity;
        const distB = b.distance != null ? b.distance : Infinity;
        if (distA !== distB) {
            return distA - distB;
        }
        const timeA = a.startTime ? new Date(a.startTime).getTime() : 0;
        const timeB = b.startTime ? new Date(b.startTime).getTime() : 0;
        return timeA - timeB;
    });
};

import jwt from "jsonwebtoken";
import { prisma } from "../../config/db.js";

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
        return controlled;
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

/** Default ~city-scale discovery; override with query radiusKm or DISCOVERY_RADIUS_KM env. */
export const getDiscoveryRadiusMeters = (req) => {
    const fromQuery = parseFloat(req.query?.radiusKm);
    if (!isNaN(fromQuery) && fromQuery > 0) {
        return fromQuery * 1000;
    }

    const hasCityContext = Boolean(req.query?.city && String(req.query.city).trim());
    if (hasCityContext) {
        const cityRadius = parseFloat(process.env.DISCOVERY_CITY_RADIUS_KM);
        if (!isNaN(cityRadius) && cityRadius > 0) {
            return cityRadius * 1000;
        }
        return 80 * 1000;
    }

    const fromEnv = parseFloat(process.env.DISCOVERY_RADIUS_KM);
    if (!isNaN(fromEnv) && fromEnv > 0) {
        return fromEnv * 1000;
    }
    return 50 * 1000;
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
    alwaysShow = false
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

    const dist = haversineDistance(userLat, userLng, parseFloat(eventLat), parseFloat(eventLng));
    return dist <= radiusMeters;
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

/** Single-player raid zone: user holds it with an active shield. */
export const userControlsSinglePlayerZone = (zone, userId, now = new Date()) => {
    if (!userId || !zone?.currentOwnerId || zone.currentOwnerId !== userId) {
        return false;
    }
    if (!zone.shieldExpiresAt) {
        return true;
    }
    return new Date(zone.shieldExpiresAt) > now;
};

/**
 * Map visibility for SinglePlayerZone: within radius of live GPS, same city (field + distance cap), or user controls.
 */
export const shouldShowSinglePlayerZoneOnMap = (
    zone,
    { coords, radiusMeters, city, userId, now = new Date() }
) => {
    if (userControlsSinglePlayerZone(zone, userId, now)) {
        return true;
    }

    if (!coords) {
        return false;
    }

    const dist = haversineDistance(
        coords.lat,
        coords.lng,
        parseFloat(zone.latitude),
        parseFloat(zone.longitude)
    );

    if (dist <= radiusMeters) {
        return true;
    }

    if (
        city &&
        zone.city &&
        String(zone.city).trim().toLowerCase() === String(city).trim().toLowerCase()
    ) {
        const cityCapKm = parseFloat(process.env.DISCOVERY_CITY_RADIUS_KM) || 80;
        return dist <= cityCapKm * 1000;
    }

    return false;
};

/** Bounding box + owned zones for Prisma singlePlayerZone queries. */
export const buildSinglePlayerZoneMapWhere = ({ userId, coords, radiusMeters, now = new Date() }) => {
    const controlledByUser =
        userId ?
            {
                currentOwnerId: userId,
                shieldExpiresAt: { gt: now },
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

    return {
        isActive: true,
        OR: [
            ...(controlledByUser ? [controlledByUser] : []),
            inBoundingBox,
        ],
    };
};

export const applyDiscoveryLocationFilter = (events, req, { getLatLng, getAlwaysShow }) => {
    const coords = resolveMapCoordinates(req);
    const radiusMeters = getDiscoveryRadiusMeters(req);

    let filtered = events;
    if (!coords) {
        filtered = events.filter((event) => getAlwaysShow(event));
    } else {
        filtered = events.filter((event) => {
            const { lat: eventLat, lng: eventLng } = getLatLng(event);
            return shouldShowInDiscovery({
                userLat: coords.lat,
                userLng: coords.lng,
                eventLat,
                eventLng,
                radiusMeters,
                alwaysShow: getAlwaysShow(event)
            });
        });
    }

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
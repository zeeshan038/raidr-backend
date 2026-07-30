import jwt from "jsonwebtoken";

export const generateToken = (user) => {
    return jwt.sign({ user }, process.env.JWT_SECRET);
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

export const isSameCountryOrClose = (lat1, lon1, lat2, lon2) => {
    if (lat1 === null || lat1 === undefined || lon1 === null || lon1 === undefined ||
        lat2 === null || lat2 === undefined || lon2 === null || lon2 === undefined) {
        return false;
    }
    const dist = haversineDistance(parseFloat(lat1), parseFloat(lon1), parseFloat(lat2), parseFloat(lon2));
    // 500 km limit dynamically restricts discovery to the user's region/country without hardcoded lists
    return dist <= 500000; 
};
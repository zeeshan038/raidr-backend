//Utils
import { tagWikiKeywords, isNonTouristRoutePlace } from '../utils/tripUtils.js';

/**
 * @Description This function is used to calculate the distance between two points.
 * @type Function
 * @input lat1 - Number
 * @input lon1 - Number
 * @input lat2 - Number
 * @input lon2 - Number
 * @returns response - Number
 */
function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // in metres
}


/**
 * @Description This function is used to check if a keyword is related to food.
 * @type Function
 * @input kw - String
 * @returns response - Boolean
 */
function isFoodKeyword(kw) {
    const foodKeywords = tagWikiKeywords['Culinary'];
    return foodKeywords && foodKeywords.includes(kw);
}

/**
 * @Description This function is used to convert Google Place types to display category.
 * @type Function
 * @input place - Object
 * @input fallbackTag - String
 * @returns response - String
 */
function googlePlaceTypesToDisplayCategory(place, fallbackTag) {
    if (place.types && place.types.length > 0) {
        return place.types[0].replace(/_/g, ' ');
    }
    return fallbackTag;
}

/**
 * @Description This function is used to ingest a place.
 * @type Function
 * @input place - Object
 * @input tag - String
 * @returns response - Object
 */
function ingestPlace(place, tag) {
    const id = place.place_id;
    const loc = place.geometry?.location;
    if (!loc) return null;

    const lat = Number(loc.lat);
    const lng = Number(loc.lng);
    if (lat === 0 && lng === 0) return null;

    const name = (place.name || 'Unknown').trim();
    const key = id || `${name.toLowerCase()}_${lat.toFixed(5)}_${lng.toFixed(5)}`;

    return {
        key,
        tagged: {
            name,
            category: googlePlaceTypesToDisplayCategory(place, tag),
            lat, lng,
            visible: false,
            isSurprise: false,
            googleTypes: place.types || [],
        },
    };
}

/**
 * @Description This function is used to search for nearby places.
 * @type Function
 * @input lat - Number
 * @input lng - Number
 * @input radiusMeters - Number
 * @input keyword - String
 * @returns response - Object
 */
export async function placesNearby(lat, lng, radiusMeters, keyword) {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radiusMeters}&keyword=${encodeURIComponent(keyword)}&language=en&key=${apiKey}`;
    try {
        const res = await fetch(url);
        const data = await res.json();
        return data.results || [];
    } catch (err) {
        console.error("Google Places Nearby Error:", err);
        return [];
    }
}

/**
 * @Description This function is used to search for biased text search places.
 * @type Function
 * @input lat - Number
 * @input lng - Number
 * @input query - String
 * @input radiusMeters - Number
 * @returns response - Object
 */
export async function placesTextSearchBiased(lat, lng, query, radiusMeters) {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&location=${lat},${lng}&radius=${radiusMeters}&language=en&key=${apiKey}`;
    try {
        const res = await fetch(url);
        const data = await res.json();
        return data.results || [];
    } catch (err) {
        console.error("Google Places TextSearch Error:", err);
        return [];
    }
}

/**
 * @Description This function is used to search for route breakpoints.
 * @type Function
 * @input startLat - Number
 * @input startLng - Number
 * @input keywords - Array
 * @input radiusKm - Number
 * @input targetPoolSize - Number
 * @input minCandidatesOverride - Number
 * @input ensureAllKeywordsSearchedAtFirstRadius - Boolean
 * @input excludePlaceKeys - Array
 * @returns response - Array
 */
export async function searchRouteBreakpoints({
    startLat, startLng,
    keywords,
    radiusKm = 10,
    targetPoolSize = 50,
    minCandidatesOverride = null,
    ensureAllKeywordsSearchedAtFirstRadius = false,
    excludePlaceKeys = null,
}) {
    const baseRadiusM = radiusKm * 1000;
    const sortedRadii = [...new Set([
        Math.min(Math.max(baseRadiusM, 1500), 50000),
        12000, 20000, 35000, 50000,
    ].map(r => Math.min(Math.max(r, 500), 50000)))].sort((a, b) => a - b);

    const expandedKeywords = [...new Set(keywords)];
    const onlyFoodBase = keywords.every(isFoodKeyword);
    const nearbyKeywordOrder = expandedKeywords;

    const minCandidates = minCandidatesOverride ?? Math.min(Math.max(targetPoolSize * 2, 36), 60);
    const uniqueByPlaceId = new Map();

    function ingestPlaces(places, tag) {
        for (const place of places) {
            const parsed = ingestPlace(place, tag);
            if (!parsed || uniqueByPlaceId.has(parsed.key)) continue;
            if (excludePlaceKeys && excludePlaceKeys.has(parsed.key)) continue;

            // Do not ingest if it's not a valid tourist route place
            if (isNonTouristRoutePlace(parsed.tagged)) continue;

            uniqueByPlaceId.set(parsed.key, parsed.tagged);
        }
    }

    // Pass 1-2: Nearby at increasing radii
    for (let ri = 0; ri < sortedRadii.length; ri++) {
        const radius = sortedRadii[ri];
        const fullSweep = ri === 0 && ensureAllKeywordsSearchedAtFirstRadius;

        if (fullSweep) {
            const responses = await Promise.all(
                nearbyKeywordOrder.map(kw => placesNearby(startLat, startLng, radius, kw))
            );
            responses.forEach((res, i) => ingestPlaces(res, nearbyKeywordOrder[i]));
        } else {
            for (const kw of nearbyKeywordOrder) {
                ingestPlaces(await placesNearby(startLat, startLng, radius, kw), kw);
                if (uniqueByPlaceId.size >= minCandidates) break;
            }
        }
        if (uniqueByPlaceId.size >= minCandidates) break;
    }

    // Pass 3: Text search if still under min
    if (uniqueByPlaceId.size < minCandidates) {
        const foodTextBoost = onlyFoodBase ? [
            'top rated restaurants near me', 'fine dining near me',
            'local food near me', 'cafes near me', 'best ice cream near me',
        ] : [];
        const textQueries = [
            ...nearbyKeywordOrder.slice(0, 12),
            ...foodTextBoost,
            'popular attraction', 'best places to visit'
        ];

        const textResponses = await Promise.all(
            textQueries.map(q => placesTextSearchBiased(startLat, startLng, q, 20000))
        );
        textResponses.forEach((res, i) => ingestPlaces(res, textQueries[i]));
    }

    const allLocations = [...uniqueByPlaceId.values()].sort(
        (a, b) => haversine(startLat, startLng, a.lat, a.lng) - haversine(startLat, startLng, b.lat, b.lng)
    );

    return allLocations;
}

/**
 * @Description Get a Google Places search keyword string for a given vibe/category
 * @type Function
 * @input categoryKey - String
 * @returns response - String
 */
export function surpriseKeywordForCategory(categoryKey) {
    const map = {
        'shopping': 'shopping mall clothing store',
        'party': 'night club bar lounge',
        'nature': 'park hiking trail garden',
        'culinary': 'restaurant cafe dining',
    };
    return map[(categoryKey || '').toLowerCase()] || 'popular attraction';
}

/**
 * @Description Search for surprise fallback candidates via Google Places
 * @type Function
 * @input originLat - Number
 * @input originLng - Number
 * @input categoryKey - String
 * @input keywordOverride - String
 * @returns response - Array
 */
export async function fetchSurpriseNearbyCandidates(originLat, originLng, categoryKey, keywordOverride = null) {
    const keyword = keywordOverride || surpriseKeywordForCategory(categoryKey);
    const seen = new Set();
    const buf = [];
    const radii = [1800, 4000, 8000];

    for (const radius of radii) {
        const results = await placesNearby(originLat, originLng, radius, keyword);
        for (const place of results) {
            const loc = place.geometry?.location;
            if (!loc) continue;

            const lat = Number(loc.lat);
            const lng = Number(loc.lng);
            if (lat === 0 && lng === 0) continue;

            if (!seen.has(place.place_id)) {
                seen.add(place.place_id);
                buf.push({
                    place_id: place.place_id,
                    name: place.name,
                    lat,
                    lng,
                    category: categoryKey || 'Surprise',
                    dist: haversine(originLat, originLng, lat, lng)
                });
            }
        }
        if (buf.length >= 12) break;
    }

    return buf.sort((a, b) => a.dist - b.dist);
}

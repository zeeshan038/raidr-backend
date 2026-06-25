
export const tagWikiKeywords = {
    "Nightlife": ["night club", "bar", "pub", "lounge", "live music", "speakeasy"],
    "Children": ["amusement park", "zoo", "aquarium", "children's museum", "park", "playground"],
    "Culinary": ["fine dining", "local food", "food market", "cafe", "top rated restaurant", "street food"],
    "Party": ["beach club", "dance club", "party event", "festival", "nightlife"],
    "Shopping": ["shopping mall", "boutique", "flea market", "designer store", "outlet"],
    "Nature": ["national park", "hiking trail", "botanical garden", "scenic viewpoint", "beach", "lake"],
    "Markets": ["farmers market", "night market", "street market", "bazaar"],
    "Culture": ["museum", "art gallery", "historical landmark", "temple", "monument", "theater"]
};

/**
 * @Description This function is used to expand tags.
 * @type Function
 * @input parentTags - Array
 * @returns response - Array
 */
export function expandTags(parentTags) {
    const subTags = [];
    for (const tag of parentTags) {
        const values = tagWikiKeywords[tag];
        if (values) subTags.push(...values);
    }
    return subTags;
}


/**
 * @Description This function is used to interleave keywords from selected vibes to ensure diversity in search
 * @type Function
 * @input likedTitles - Array
 * @returns response - Array
 */
/**
 * Plan flow start anchor: hotel → destination → explicit start/GPS fallback.
 */
export function resolveStartPointForPlan({ hotelLat, hotelLng, destinationLat, destinationLng, startLat, startLng }) {
    if (hotelLat != null && hotelLng != null) {
        return { lat: hotelLat, lng: hotelLng };
    }
    if (destinationLat != null && destinationLng != null) {
        return { lat: destinationLat, lng: destinationLng };
    }
    if (startLat != null && startLng != null) {
        return { lat: startLat, lng: startLng };
    }
    return null;
}


export function fairInterleavedSearchKeywords(likedTitles) {
    const groups = likedTitles.map(t => expandTags([t])).filter(g => g.length);
    if (!groups.length) {
        return expandTags(['Nightlife', 'Nature', 'Shopping', 'Culinary']);
    }
    const out = [];
    let round = 0;
    let progressed = true;
    while (progressed) {
        progressed = false;
        for (const g of groups) {
            if (round < g.length) { 
                out.push(g[round]); 
                progressed = true; 
            }
        }
        round++;
    }
    return out;
}


/**
 * @Description This function is used to filter out places that aren't good for tourists (e.g., parking lots, random stores)
 * @type Function
 * @input loc - Object
 * @returns response - Boolean
 */
export function isNonTouristRoutePlace(loc) {
    const types = loc.googleTypes || [];
    const category = (loc.category || "").toLowerCase();
    const name = (loc.name || "").toLowerCase();

    const excludeTypes = ['parking', 'electronics_store', 'hardware_store', 'car_repair', 'laundry', 'gas_station', 'convenience_store'];
    if (types.some(t => excludeTypes.includes(t))) return true;

    const excludeKeywords = ['parking', 'garage', 'supermarket', 'pharmacy', 'laundromat'];
    if (excludeKeywords.some(kw => name.includes(kw) || category.includes(kw))) return true;

    return false;
}


/**
 * @Description This function is used to filter out places that are not appropriate for a family trip
 * @type Function
 * @input loc - Object
 * @returns response - Boolean
 */
export function isPlaceInappropriateForFamilyTrip(loc) {
    const blockedTypes = ['bar', 'pub', 'wine_bar', 'night_club', 'liquor_store', 'casino'];
    const types = loc.googleTypes || [];
    const category = (loc.category || "").toLowerCase();
    const name = (loc.name || "").toLowerCase();

    if (types.some(t => blockedTypes.includes(t))) return true;

    const blockedKeywords = ['club', 'casino', 'bar', 'pub', 'lounge', 'adult'];
    if (blockedKeywords.some(kw => name.includes(kw) || category.includes(kw))) return true;

    return false;
}

/**
 * @Description This function is used to determine the primary vibe for a place based on its keywords/types
 * @type Function
 * @input loc - Object
 * @input likedTitles - Array
 * @returns response - String
 */
function primaryVibeForPlace(loc, likedTitles) {
    const searchableText = `${loc.name} ${loc.category} ${(loc.googleTypes || []).join(' ')}`.toLowerCase();
    for (const vibe of likedTitles) {
        const keywords = tagWikiKeywords[vibe] || [];
        if (keywords.some(kw => searchableText.includes(kw.toLowerCase()))) {
            return vibe;
        }
    }
    return likedTitles.length > 0 ? likedTitles[0] : 'Culture';
}

// Shuffle an array (Fisher-Yates)
function shuffleArray(array) {
    let curId = array.length;
    while (0 !== curId) {
        let randId = Math.floor(Math.random() * curId);
        curId -= 1;
        let tmp = array[curId];
        array[curId] = array[randId];
        array[randId] = tmp;
    }
    return array;
}

/**
 * @Description Interleave raw plan candidates by vibe to ensure chunk diversity for AI
 * @type Function
 * @input raw - Array
 * @input likedTitles - Array
 * @returns response - Array
 */
export function interleavePlanRawForChunkDiversity(raw, likedTitles) {
    if (!likedTitles || likedTitles.length === 0) return raw;
    
    const buckets = {};
    for (const vibe of likedTitles) buckets[vibe] = [];
    
    for (const loc of raw) {
        const v = primaryVibeForPlace(loc, likedTitles);
        if (buckets[v]) buckets[v].push(loc);
    }
    
    const interleaved = [];
    let progressed = true;
    while (progressed) {
        progressed = false;
        for (const vibe of likedTitles) {
            if (buckets[vibe] && buckets[vibe].length > 0) {
                interleaved.push(buckets[vibe].shift());
                progressed = true;
            }
        }
    }
    
    return interleaved;
}

/**
 * @Description This function is used to build the master pool ensuring vibe diversity
 * @type Function
 * @input ranked - Array
 * @input likedTitles - Array
 * @input visibleK - Number
 * @returns response - Array
 */
export function buildPlanFlowMasterPool(ranked, likedTitles, visibleK) {
    if (!likedTitles || likedTitles.length === 0) {
        likedTitles = ['Nightlife', 'Nature', 'Shopping', 'Culinary'];
    }

    const buckets = {};
    for (const vibe of likedTitles) buckets[vibe] = [];
    
    // Bucket POIs
    for (const loc of ranked) {
        const v = primaryVibeForPlace(loc, likedTitles);
        if (buckets[v]) buckets[v].push(loc);
    }

    const shuffledVibes = shuffleArray([...likedTitles]);
    const pool = [];
    const used = new Set();

    // Head: Try one POI per shuffled vibe slot
    let headCount = 0;
    while (headCount < visibleK) {
        for (const vibe of shuffledVibes) {
            if (headCount >= visibleK) break;
            if (buckets[vibe].length > 0) {
                const loc = buckets[vibe].shift();
                if (!used.has(loc.name)) {
                    pool.push(loc);
                    used.add(loc.name);
                    headCount++;
                }
            }
        }
        // Break if we ran out of items in all buckets before reaching visibleK
        if (Object.values(buckets).every(b => b.length === 0)) break;
    }

    // Tail: round-robin drain buckets + leftovers
    let progressed = true;
    while (progressed && pool.length < 50) {
        progressed = false;
        for (const vibe of shuffledVibes) {
            if (pool.length >= 50) break;
            if (buckets[vibe].length > 0) {
                const loc = buckets[vibe].shift();
                if (!used.has(loc.name)) {
                    pool.push(loc);
                    used.add(loc.name);
                    progressed = true;
                }
            }
        }
    }

    // Set visibility flag for first K items
    pool.forEach((loc, i) => { loc.visible = i < visibleK; });
    
    return pool;
}


/**
 * @Description This function is used to partition the master pool into specific days
 * @type Function
 * @input pool - Array
 * @input totalDays - Number
 * @input visibleK - Number
 * @returns response - Object
 */
export function partitionPlanFlowPoolIntoDays(pool, totalDays, visibleK) {
    const planDayTaggedStops = {};
    const planFlowRefreshQueue = [];

    for (let d = 0; d < totalDays; d++) {
        const start = d * visibleK;
        const end = start + visibleK;
        planDayTaggedStops[d] = pool.slice(start, end);
    }

    const usedCount = totalDays * visibleK;
    if (pool.length > usedCount) {
        planFlowRefreshQueue.push(...pool.slice(usedCount));
    }

    return { planDayTaggedStops, planFlowRefreshQueue };
}

// Convert tagged locations to route items
export function buildRouteItems(stops) {
    return stops.map((s, i) => ({
        index: i + 1,
        name: s.name,
        category: s.category,
        lat: s.lat,
        lng: s.lng,
        visible: s.visible,
    }));
}

/**
 * @Description Filter out places with bad names
 * @type Function
 */
export function isRealPoi(l) {
    if (!l || !l.name) return false;
    const t = l.name.trim().toLowerCase();
    return t && t !== 'unknown' && !t.includes('no location') && !t.includes('no nearby');
}

/**
 * @Description Mix candidates by category for single home vibe
 * @type Function
 */
export function mixedCandidatesForSkipAiBatch(locations, maxCount, vibe) {
    const buckets = {};
    for (const loc of locations) {
        const cat = loc.category || 'other';
        if (!buckets[cat]) buckets[cat] = [];
        buckets[cat].push(loc);
    }
    
    const categories = Object.keys(buckets);
    const result = [];
    let progressed = true;
    
    while (progressed && result.length < maxCount) {
        progressed = false;
        for (const cat of categories) {
            if (result.length >= maxCount) break;
            if (buckets[cat].length > 0) {
                result.push(buckets[cat].shift());
                progressed = true;
            }
        }
    }
    
    return result;
}

/**
 * @Description Generate a random destination coordinate within radius
 * @type Function
 */
export function randomDestination(startLat, startLng, radiusKm) {
    const r = radiusKm / 6371; 
    const lat = startLat * (Math.PI / 180);
    const lng = startLng * (Math.PI / 180);

    const randomAngle = Math.random() * 2 * Math.PI;
    const randomRadius = r * (0.5 + Math.random() * 0.5);

    const newLat = Math.asin(Math.sin(lat) * Math.cos(randomRadius) +
        Math.cos(lat) * Math.sin(randomRadius) * Math.cos(randomAngle));

    const newLng = lng + Math.atan2(Math.sin(randomAngle) * Math.sin(randomRadius) * Math.cos(lat),
        Math.cos(randomRadius) - Math.sin(lat) * Math.sin(newLat));

    return {
        lat: newLat * (180 / Math.PI),
        lng: newLng * (180 / Math.PI)
    };
}

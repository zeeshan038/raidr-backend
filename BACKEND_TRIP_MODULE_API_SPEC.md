# Wonder Trip — Trip Module Backend API Specification

> **Purpose:** Complete A→Z reference for a Node.js backend that mirrors the Flutter app’s trip module: Skip flow, Plan Your Trip flow, Google Places search, OpenAI ranking, pools, route overview, map navigation rewards, Surprise Me, merchant campaigns, and exploration side drops.
>
> **Source of truth:** Flutter repo paths under `lib/features/trip/`, `lib/core/services/`, `lib/core/utils/trip_utils/`.
>
> **Last synced:** June 2026

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [User Flows (A→Z)](#2-user-flows-az)
3. [Data Models (JSON Schemas)](#3-data-models-json-schemas)
4. [Constants & Enums](#4-constants--enums)
5. [Vibe → Keyword Expansion](#5-vibe--keyword-expansion)
6. [Google Places Search (`searchRouteBreakpoints`)](#6-google-places-search-searchroutebreakpoints)
7. [OpenAI Ranking (`rankLocationsWithAI`)](#7-openai-ranking-ranklocationswithai)
8. [Skip Flow — Route Generation](#8-skip-flow--route-generation)
9. [Plan Your Trip — Route Generation](#9-plan-your-trip--route-generation)
10. [Pool Refresh (Skip & Plan)](#10-pool-refresh-skip--plan)
11. [Route Overview & Trip Save](#11-route-overview--trip-save)
12. [Map Navigation — Normal Stops & Mystery Boxes](#12-map-navigation--normal-stops--mystery-boxes)
13. [Surprise Me Detour](#13-surprise-me-detour)
14. [Merchant Ads & Campaigns](#14-merchant-ads--campaigns)
15. [Exploration Side Drops](#15-exploration-side-drops)
16. [Suggested REST API Endpoints](#16-suggested-rest-api-endpoints)
17. [Source File Index](#17-source-file-index)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CLIENT (Flutter)                                 │
├─────────────────────────────────────────────────────────────────────────┤
│ Skip: Home → vibe + radius → LoadingScreen → RouteOverview → MapNav     │
│ Plan: Form → VibeScreen (swipe likes) → Loading → RouteOverview → Nav   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
            Google Places      OpenAI GPT      Firestore
            (Nearby/Text)      (ranking)       (trips, users, merchant_ads)
```

**Backend responsibility:** Move heavy logic off-device:
- `POST /trips/generate/skip` — full skip pipeline
- `POST /trips/generate/plan` — full plan pipeline
- `POST /trips/refresh/skip` / `POST /trips/refresh/plan` — pool slot swap
- `POST /surprise/resolve` — Firebase ad → Places → geometry fallback
- `POST /exploration-drops/spawn` — side quest POIs near anchor
- `GET /merchant-ads/banner` — skip home sponsored banner
- `POST /rewards/award` — XP + box counts (optional; today client writes Firestore directly)

---

## 2. User Flows (A→Z)

### 2.1 Skip Flow

| Step | Screen / Controller | Action |
|------|----------------------|--------|
| 1 | `home_screen.dart` | User on Home tab; countdown → Skip Adventure panel |
| 2 | `home_controller.dart` ~279 | `tripFlowKind = skip`, `resetSkipFlowForNewHomeVibe(vibe)` |
| 3 | `skip_controller.dart` 130 | `setupSkipButtonAddress` — GPS → `routePoints[0]` |
| 4 | `loading_screen.dart` 147 | `generateRoutes()` |
| 5 | `trip_controller.dart` 1275 | `_generateSkipFlowRoutes()` |
| 6 | `route_overview_screen.dart` | Map + list; optional Refresh per row |
| 7 | `createUserTrip` 1058 | Save to Firestore; if today → `MapBoxNavigationScrene` |

**Start anchor:** Current GPS (`_resolveStartPoint`, line 2026).  
**Search radius:** `skipSearchRadiusKm` (default 2.0 km; UI options 0.25–2 km).  
**Days:** Always **1** (`divideLocationsByDays(..., 1)`).  
**Visible stops K:** 3 relaxed / 6 intense (`isPace`).

### 2.2 Plan Your Trip Flow

| Step | Screen / Controller | Action |
|------|----------------------|--------|
| 1 | `plane_your_trip_screen.dart` | Destination, hotel, dates (1–4 days), pace, radius, party |
| 2 | `trip_section.dart` ~439 | `tripFlowKind = planYourTrip`, clear tags → `VibeScreen` |
| 3 | `vibe_screen.dart` 155 | `saveVibePreference` — liked vibes → `tags[]` |
| 4 | `loading_screen.dart` 147 | `generateRoutes()` |
| 5 | `trip_controller.dart` 1389 | `_generatePlanYourTripRoutes()` |
| 6 | `route_overview_screen.dart` | Day tabs; Refresh per row per active day |

**Start anchor:** Hotel → destination → GPS (`_resolveStartPointForPlan`, line 1863).  
**Search radius:** `selectedRadius` → 10 / 20 / 50 / 100 km.  
**Days:** `clickDates.length` clamped 1–4.  
**Visible stops K per day:** 3 / 6.

### 2.3 Map Navigation (after Start Journey)

| Feature | Controller | Trigger |
|---------|------------|---------|
| Leg simulation / GPS | `navigation_controller.dart` | `navigateCurrentLeg` |
| Green/golden mystery boxes | `trip_rewards_controller.dart` | Arrival at stop (≤42 m) |
| Purple Surprise Me box | `surprise_me_controller.dart` + rewards | ≤50 m at surprise POI |
| Side exploration drops | `exploration_drops_controller.dart` | Map ready + each leg complete |
| Return home CTA | `navigation_controller.dart` | All stops done; ≥8 m from stay |
| Travel mode | `mapTravelProfile` | driving / walking (Mapbox Directions) |

---

## 3. Data Models (JSON Schemas)

### 3.1 `TaggedLocation`

**File:** `lib/features/trip/models/tagged_location_model.dart`

```typescript
interface TaggedLocation {
  name: string;
  category: string;       // display category from Google types / keyword
  lat: number;
  lng: number;
  visible: boolean;       // true for first K stops after AI rank
  isSurprise?: boolean;   // default false
  googleTypes?: string[]; // Google Places types[]
}
```

**Dart source:**

```dart
Map<String, dynamic> toJson() => {
  "name": name,
  "category": category,
  "lat": lat,
  "lng": lng,
  "visible": visible,
  "isSurprise": isSurprise,
  if (googleTypes != null) "googleTypes": googleTypes,
};
```

### 3.2 `RouteItemModel` (saved in Firestore / route list UI)

**File:** `lib/features/trip/components/map_components/route_item.dart`

```typescript
interface RouteItemModel {
  index: number;    // 1..N (display order)
  name: string;
  category: string;
  lat: number;
  lng: number;
  visible: boolean;
}
```

### 3.3 `ExplorationSideDropModel`

**File:** `lib/features/trip/models/exploration_side_drop_model.dart`

```typescript
interface ExplorationSideDropModel {
  placeId: string;
  lat: number;
  lng: number;
  name?: string;
  isGolden: boolean;  // first drop = green (false), second = golden (true)
}
```

### 3.4 `AdLocation` (merchant campaign)

**File:** `lib/features/trip/screens/map_screen/helper/adLocationModel.dart`

```typescript
interface AdLocation {
  id: string;                    // Firestore doc id
  merchantName: string;
  adTitle: string;
  descriptionText: string;
  latitude: number;
  longitude: number;
  city: string;
  country: string;
  address: string;
  adType: string;                // default "text"
  placeCategory: string;         // shopping | party | nature | culinary
  imageUrl?: string;
  logoUrl?: string;
  isActive: boolean;
  approvalStatus: string;        // "approved" for live ads
  merchantId: string;
  stockLimit: number;            // <=0 = unlimited
  rewardClaims: number;
}
```

### 3.5 Saved Trip Document

**Collection:** `users/{uid}/user_trips/{autoId}`  
**Written by:** `trip_controller.dart` `createUserTrip` (line 1058)

```typescript
interface UserTripDocument {
  tripDates: FirebaseTimestamp[];  // one per calendar day
  routesByDate: Record<string, RouteItemModel[]>;  // key "yyyy-MM-dd"
  routeTitle: string;
  hotelLocation: string;
  destination: string;
  status: "in-progress" | "upcoming";
  tripPace: boolean;               // false=relaxed K=3, true=intense K=6
  radiusKm: number;
  travelWith: "Solo" | "Couple" | "Friends" | "Family";
  interestedVibes: string[];       // English keys: Nightlife, Culinary, ...
  imageUrls: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  isShared?: boolean;              // squad invite only
  // Live nav (optional updates during trip):
  liveLat?: number;
  liveLng?: number;
}
```

### 3.6 User Progress (XP / boxes)

**Collection:** `users/{uid}`  
**Written by:** `trip_rewards_controller.dart` `_saveProgress` (line 217)

```typescript
interface UserProgress {
  level: number;                  // default 1
  xp_earned: number;              // lifetime cumulative XP
  xp_progress: number;              // bank toward next level
  green_boxes_count: number;
  golden_boxes_count: number;
  purple_boxes_count: number;
  distance_covered_km: number;
}
```

### 3.7 Merchant Claim

**Collection:** `users/{uid}/merchant_ad_claims/{merchantAdDocumentId}`

```typescript
interface MerchantAdClaim {
  merchantAdId: string;
  merchantId: string;
  merchantName: string;
  adTitle: string;
  city: string;
  country: string;
  address: string;
  latitude: number;
  longitude: number;
  claimedAt: Timestamp;
}
```

---

## 4. Constants & Enums

```typescript
enum TripFlowKind { skip = "skip", planYourTrip = "planYourTrip" }

// Skip pool (trip_controller.dart 358-365)
const skipFlowPoolMin = 15;
const skipFlowPoolMax = 20;
const skipFlowAiBatchDefault = 30;
const skipFlowAiBatchStratified = 42;

// Plan pool (384-386)
const planFlowPoolRawMin = 80;
const planFlowPoolCap = 100;
const planFlowRankChunkSize = 28;

// Stops
const relaxedK = 3;
const intenseK = 6;
const maxPlanDays = 4;

// Skip radius options (meters) — skip_flow_radius_options.dart
const kSkipFlowRadiusOptions = [250, 500, 1000, 2000];
const kSkipFlowDefaultRadiusMeters = 2000;

// Plan radius options (km)
const radiusOptions = [10, 20, 50, 100];

// Mystery box distances (trip_rewards_controller.dart)
const mysteryLyingOuterM = 200;
const mysteryOpenInnerM = 42;

// Surprise Me (surprise_me_controller.dart)
const surpriseMerchantMinM = 100;
const surpriseMerchantMaxM = 1500;
const surpriseOpenRadiusM = 50;

// Exploration drops (exploration_drops_controller.dart)
const placesApiRadiusM = 300;
const maxDropDistanceFromAnchorM = 100;
const openDistanceM = 5;
const minSeparationBetweenDropsM = 48;
const maxDrops = 2;

// XP ranges (_generateXP)
// green: 1-50, golden: 51-100, purple: 51-100
// Box alternation: odd stops → green, even → golden
```

---

## 5. Vibe → Keyword Expansion

**File:** `lib/features/trip/controllers/skip_controller.dart` (15-26)

```javascript
// Node.js equivalent
function expandTags(parentTags, tagWikiKeywords) {
  const subTags = [];
  for (const tag of parentTags) {
    const values = tagWikiKeywords[tag];
    if (values) subTags.push(...values);
  }
  return subTags;
}
```

**Full `tagWikiKeywords` map** — copy verbatim from `trip_controller.dart` lines 388-552:

| Vibe key | Used in |
|----------|---------|
| Nightlife | Plan vibe cards |
| Children | Plan |
| Culinary | Skip home + Plan |
| Party | Skip home + Plan |
| Shopping | Skip home + Plan |
| Nature | Skip home + Plan |
| Markets | Plan |
| Culture | Plan |

**Plan-only fair search interleave** (`_fairInterleavedSearchKeywords`, line 1539):

```javascript
function fairInterleavedSearchKeywords(likedTitles, tagWikiKeywords) {
  const groups = likedTitles.map(t => expandTags([t], tagWikiKeywords)).filter(g => g.length);
  if (!groups.length) {
    return expandTags(['Nightlife', 'Nature', 'Shopping', 'Culinary'], tagWikiKeywords);
  }
  const out = [];
  let round = 0;
  let progressed = true;
  while (progressed) {
    progressed = false;
    for (const g of groups) {
      if (round < g.length) { out.push(g[round]); progressed = true; }
    }
    round++;
  }
  return out;
}
```

---

## 6. Google Places Search (`searchRouteBreakpoints`)

**File:** `lib/features/trip/components/map_components/destination_point.dart` (261-476)  
**HTTP wrapper:** `lib/core/services/google_places_helper.dart`

### 6.1 Nearby Search

```
GET https://maps.googleapis.com/maps/api/place/nearbysearch/json
  ?key=GOOGLE_PLACES_API_KEY
  &location={lat},{lng}
  &radius={meters}          // 1-50000
  &keyword={keyword}        // optional
  &language=en
```

**Parse each result:**

```javascript
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
```

### 6.2 Text Search (fallback)

```
GET https://maps.googleapis.com/maps/api/place/textsearch/json
  ?key=...
  &query={query}
  &location={lat},{lng}
  &radius=20000
  &language=en
```

### 6.3 Algorithm (port exactly)

```javascript
async function searchRouteBreakpoints({
  startLat, startLng,
  keywords,
  radiusKm = 3,
  targetPoolSize = 18,
  minCandidatesOverride = null,
  ensureAllKeywordsSearchedAtFirstRadius = false,
  excludePlaceKeys = null,
}) {
  const baseRadiusM = radiusKm * 1000;
  const sortedRadii = [...new Set([
    Math.min(Math.max(baseRadiusM, 1500), 50000),
    12000, 20000, 35000, 50000,
  ].map(r => Math.min(Math.max(r, 500), 50000)))].sort((a,b) => a-b);

  const expandedKeywords = expandedSearchKeywords(keywords); // see Dart _expandedSearchKeywords
  const onlyFoodBase = keywords.every(isFoodKeyword);
  const nearbyKeywordOrder = onlyFoodBase
    ? roundRobinFoodNearbyKeywords(expandedKeywords)
    : expandedKeywords;
  const minCandidates = minCandidatesOverride ?? Math.min(Math.max(targetPoolSize * 2, 36), 60);

  const uniqueByPlaceId = new Map();

  function ingestPlaces(places, tag) {
    for (const place of places) {
      const parsed = ingestPlace(place, tag);
      if (!parsed || uniqueByPlaceId.has(parsed.key)) continue;
      if (excludePlaceKeys?.has(parsed.key)) continue;
      uniqueByPlaceId.set(parsed.key, parsed.tagged);
    }
  }

  // Pass 1-2: Nearby at increasing radii
  for (let ri = 0; ri < sortedRadii.length; ri++) {
    const radius = sortedRadii[ri];
    const fullSweep = ri === 0 && ensureAllKeywordsSearchedAtFirstRadius;

    if (fullSweep) {
      const responses = await Promise.all(
        nearbyKeywordOrder.map(kw => placesNearby(startLat, startLng, radius, kw, 30))
      );
      responses.forEach((res, i) => ingestPlaces(res, nearbyKeywordOrder[i]));
    } else {
      for (const kw of nearbyKeywordOrder) {
        ingestPlaces(await placesNearby(startLat, startLng, radius, kw, 30), kw);
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
      'popular restaurant', 'best food near me',
    ];
    const textResponses = await Promise.all(
      textQueries.map(q => placesTextSearchBiased(startLat, startLng, q, 20000, 20))
    );
    textResponses.forEach((res, i) => ingestPlaces(res, textQueries[i]));
  }

  const allLocations = [...uniqueByPlaceId.values()].sort(
    (a, b) => haversine(startLat, startLng, a.lat, a.lng) - haversine(startLat, startLng, b.lat, b.lng)
  );
  allLocations.forEach((loc, i) => { loc.visible = i < 3; });
  return allLocations;
}
```

### 6.4 POI Filters (apply after search)

**Non-tourist filter** — `lib/core/utils/trip_utils/tourist_route_place_filter.dart`:

```javascript
function isNonTouristRoutePlace(loc) {
  // Exclude: parking lots/garages, electronics stores
  // Keep: national park, theme park, etc.
  // Check googleTypes, category, name patterns — see Dart file lines 14-114
}
```

**Family plan filter** — `lib/core/utils/trip_utils/family_friendly_plan_trip_filter.dart` (only when `travelWith === "Family"`):

```javascript
function isPlaceInappropriateForFamilyTrip(loc) {
  const blockedTypes = ['bar','pub','wine_bar','night_club','liquor_store','casino',...];
  // Check googleTypes, category, name regex — see Dart lines 15-73
}
```

---

## 7. OpenAI Ranking (`rankLocationsWithAI`)

**File:** `lib/core/services/openAi_service.dart` (363-517)

### 7.1 Request

```
POST https://api.openai.com/v1/chat/completions
Authorization: Bearer OPENAI_API_KEY
```

```json
{
  "model": "gpt-4o-mini",
  "temperature": 0.45,
  "messages": [
    {
      "role": "system",
      "content": "<systemRules — local travel expert, rank by vibes, return JSON order permutation>"
    },
    {
      "role": "user",
      "content": "{\"user_vibes\":[...],\"mode\":\"relax|intense\",\"candidates\":[{\"index\":0,\"name\":\"...\",\"category\":\"...\",\"lat\":0,\"lng\":0},...]}"
    }
  ]
}
```

**System rules extras:**
- `skipHomeSingleVibeForRanking`: Shopping | Party | Nature | Culinary → append variety rules (`_appendSkipHomeVibeVariety`, line 328)
- `planMultiVibeDiversity: true` → multi-vibe plan chunk instruction (line 413)

**Expected response JSON:**

```json
{ "order": [2, 0, 5, 1, ...] }
```

`order` must be a **permutation** of indices `0..n-1`. Fallback: legacy `{ "places": ["Name1", "Name2"] }`.

### 7.2 Node.js implementation

```javascript
async function rankLocationsWithAI({
  candidates,
  userTags,
  intenseMode,
  rankedResultCap = 20,
  skipHomeSingleVibeForRanking = null,
  planMultiVibeDiversity = false,
}) {
  const visibleCount = intenseMode ? 6 : 3;
  if (!candidates.length) return [];

  // Fallback if no API key: distance order + visible flags
  const ranked = applyOrderFromOpenAI(candidates, await callOpenAI(...));
  ranked.forEach((loc, i) => { loc.visible = i < visibleCount; });
  return ranked.slice(0, rankedResultCap);
}
```

### 7.3 Chunked plan ranking

**File:** `trip_controller.dart` `_rankPlanCandidatesChunked` (1662-1693)

```javascript
async function rankPlanCandidatesChunked(raw, keywordTags, multiVibePlan) {
  const chunkSize = 28;
  const futures = [];
  for (let i = 0; i < raw.length; i += chunkSize) {
    const chunk = raw.slice(i, Math.min(i + chunkSize, raw.length));
    futures.push(rankLocationsWithAI({
      candidates: chunk,
      userTags: keywordTags,
      intenseMode,
      rankedResultCap: chunk.length,
      planMultiVibeDiversity: multiVibePlan,
    }));
  }
  const parts = await Promise.all(futures);
  return parts.flat();
}
```

### 7.4 Loading screen AI (optional endpoints)

| Function | File line | Model | Output |
|----------|-----------|-------|--------|
| `generateCityVibeSuggestions` | openAi_service.dart 128 | gpt-4o-mini | JSON array of 3 strings |
| `generateLoadingTexts` | 256 | gpt-3.5-turbo | JSON array of 10 short strings |

---

## 8. Skip Flow — Route Generation

**Entry:** `generateRoutes()` → `_generateSkipFlowRoutes()` (`trip_controller.dart` 1275-1382)

### 8.1 Request body (suggested API)

```json
{
  "flow": "skip",
  "startLat": 31.56,
  "startLng": 74.31,
  "tags": ["Culinary"],
  "intenseMode": false,
  "radiusKm": 2.0
}
```

### 8.2 Pipeline (implement in order)

```javascript
async function generateSkipFlowRoutes(input) {
  const visibleK = input.intenseMode ? 6 : 3;
  const keywords = expandTags(input.tags.length ? input.tags
    : ['Nightlife','Nature','Shopping','Children','Culinary'], tagWikiKeywords);

  let locations = await searchRouteBreakpoints({
    startLat: input.startLat,
    startLng: input.startLng,
    radiusKm: input.radiusKm,
    numBreakpoints: visibleK,
    keywords,
    targetPoolSize: 20,
  });
  locations = locations.filter(l => !isNonTouristRoutePlace(l));

  const skipSingleHomeVibe = input.tags.length === 1
    && ['Shopping','Party','Nature','Culinary'].includes(input.tags[0])
    ? input.tags[0] : null;

  const aiBatch = skipSingleHomeVibe
    ? mixedCandidatesForSkipAiBatch(locations, 42, skipSingleHomeVibe)
    : locations.slice(0, 30);

  let ranked = await rankLocationsWithAI({
    candidates: aiBatch,
    userTags: keywords,
    intenseMode: input.intenseMode,
    skipHomeSingleVibeForRanking: skipSingleHomeVibe,
  });

  let pool = ranked.filter(isRealPoi).slice(0, 20);
  if (pool.length < 15) {
    // backfill from raw locations
    const used = new Set(pool.map(l => `${l.name}_${l.lat}_${l.lng}`));
    for (const loc of locations) {
      if (pool.length >= 20) break;
      if (!isRealPoi(loc) || isNonTouristRoutePlace(loc)) continue;
      const k = `${loc.name}_${loc.lat}_${loc.lng}`;
      if (!used.has(k)) { used.add(k); pool.push(loc); }
    }
  }

  const skipFlowPlacePool = pool;
  const itineraryStops = skipFlowPlacePool.slice(0, visibleK);
  const routeItems = buildRouteItems(itineraryStops); // index 1..N

  return {
    skipFlowPlacePool,
    itineraryStops,
    routeItems,
    generatedStartPoint: { lat: input.startLat, lng: input.startLng },
    generatedDestinationPoint: itineraryStops.length
      ? { lat: itineraryStops.at(-1).lat, lng: itineraryStops.at(-1).lng }
      : randomDestination(input.startLat, input.startLng, 1),
    dayRoutes: { 0: routeItems },
    // Polyline: client uses Mapbox Directions — backend can return ordered coords only
  };
}

function isRealPoi(l) {
  const t = l.name.trim().toLowerCase();
  return t && t !== 'unknown' && !t.includes('no location') && !t.includes('no nearby');
}

function buildRouteItems(stops) {
  return stops.map((s, i) => ({
    index: i + 1,
    name: s.name,
    category: s.category,
    lat: s.lat,
    lng: s.lng,
    visible: s.visible,
  }));
}
```

### 8.3 Stratified AI batch (single home vibe)

**File:** `lib/core/utils/trip_utils/skip_flow_ai_candidate_mix.dart`

When user picks exactly one of Shopping / Party / Nature / Culinary on home map, bucket POIs by subcategory (e.g. Culinary → sweetDrinks, fastCasual, sitDown, other) then **round-robin** up to 42 candidates before AI.

```javascript
function mixedCandidatesForSkipAiBatch(distanceAscending, maxCount, vibe) {
  const buckets = bucketsForHomeSkipVibe(distanceAscending, vibe);
  return roundRobinBucketLists(buckets, distanceAscending, maxCount);
}
```

---

## 9. Plan Your Trip — Route Generation

**Entry:** `_generatePlanYourTripRoutes()` (`trip_controller.dart` 1389-1533)

### 9.1 Request body (suggested API)

```json
{
  "flow": "planYourTrip",
  "startLat": 25.20,
  "startLng": 55.27,
  "hotelLat": 25.21, 
  "hotelLng": 55.28,
  "tags": ["Nightlife", "Culinary", "Culture"],
  "intenseMode": false,
  "radiusKm": 10,
  "totalDays": 3,
  "travelWith": "Family"
}
```

**Start resolution:**

```javascript
function resolveStartPointForPlan(routePoints) {
  if (routePoints[1]?.lat || routePoints[1]?.lng) return routePoints[1]; // hotel
  if (routePoints[0]?.lat || routePoints[0]?.lng) return routePoints[0]; // destination
  return gpsFallback();
}
```

### 9.2 Pipeline

```javascript
async function generatePlanYourTripRoutes(input) {
  const visibleK = input.intenseMode ? 6 : 3;
  const totalDays = Math.min(Math.max(input.totalDays || 1, 1), 4);
  const likedTitles = input.tags.length ? input.tags
    : ['Nightlife','Nature','Shopping','Culinary'];

  const keywordTags = expandTags(likedTitles, tagWikiKeywords);
  const searchKeywords = fairInterleavedSearchKeywords(likedTitles, tagWikiKeywords);
  const familyPartyPlan = input.travelWith === 'Family';

  let raw = await searchRouteBreakpoints({
    startLat: input.startLat,
    startLng: input.startLng,
    radiusKm: input.radiusKm,
    numBreakpoints: visibleK,
    keywords: searchKeywords,
    targetPoolSize: 50,
    minCandidatesOverride: familyPartyPlan ? 128 : 80,
    ensureAllKeywordsSearchedAtFirstRadius: true,
  });

  raw = raw.filter(isRealPoi).filter(l => !isNonTouristRoutePlace(l));
  if (familyPartyPlan) raw = raw.filter(l => !isPlaceInappropriateForFamilyTrip(l));
  raw = raw.slice(0, 130);
  raw = interleavePlanRawForChunkDiversity(raw, likedTitles);

  const ranked = await rankPlanCandidatesChunked(raw, keywordTags, likedTitles.length > 1);
  let planFlowPlacePool = buildPlanFlowMasterPool(ranked, likedTitles, visibleK);

  const targetFill = Math.min(100, totalDays * visibleK + 24);
  // top-up from raw if pool short...

  const { planDayTaggedStops, planFlowRefreshQueue } = partitionPlanFlowPoolIntoDays(
    planFlowPlacePool, totalDays, visibleK
  );

  const dayRoutes = {};
  for (let d = 0; d < totalDays; d++) {
    dayRoutes[d] = buildRouteItems(planDayTaggedStops[d] || []);
  }

  return { planFlowPlacePool, planDayTaggedStops, planFlowRefreshQueue, dayRoutes };
}
```

### 9.3 Master pool builder

**File:** `_buildPlanFlowMasterPool` (1769-1850)

1. Bucket ranked POIs by `_primaryVibeForPlace` (longest keyword match in category/name).
2. Shuffle liked vibe order.
3. **Head** (length `visibleK`): try one POI per shuffled vibe slot.
4. **Tail**: round-robin drain buckets + leftovers.
5. Cap at `planFlowPoolCap` (100).

### 9.4 Day partition

**File:** `_partitionPlanFlowPoolIntoDays` (1571-1591)

```
Day 0: pool[0..K)
Day 1: pool[K..2K)
...
Remainder after totalDays×K → planFlowRefreshQueue
```

---

## 10. Pool Refresh (Skip & Plan)

### 10.1 Skip refresh

**File:** `refreshSkipFlowRouteSlot` (1887-1926)

```javascript
function refreshSkipFlowRouteSlot(skipFlowPlacePool, visibleIndex, intenseMode) {
  const visibleK = intenseMode ? 6 : 3;
  if (visibleIndex < 0 || visibleIndex >= visibleK) return null;
  if (skipFlowPlacePool.length <= visibleK) return null;

  const p = [...skipFlowPlacePool];
  const nextIdx = visibleK;
  const nextPlace = p.splice(nextIdx, 1)[0];
  const oldPlace = p.splice(visibleIndex, 1)[0];
  p.splice(visibleIndex, 0, nextPlace);
  p.push(oldPlace);

  const slice = p.slice(0, visibleK);
  return { skipFlowPlacePool: p, routeItems: buildRouteItems(slice) };
}
```

### 10.2 Plan refresh

**File:** `refreshPlanYourTripRouteSlot` (1932-1994)

```javascript
function refreshPlanYourTripRouteSlot({
  planDayTaggedStops, planFlowRefreshQueue, activeDayIndex,
  visibleIndex, likedVibes, intenseMode,
}) {
  const visibleK = intenseMode ? 6 : 3;
  const stops = [...planDayTaggedStops[activeDayIndex]];
  const q = [...planFlowRefreshQueue];
  if (!q.length || visibleIndex >= stops.length) return null;

  const oldVibe = primaryVibeForPlace(stops[visibleIndex], likedVibes);
  const variedIdx = q.map((_, j) => j).filter(j => primaryVibeForPlace(q[j], likedVibes) !== oldVibe);
  const pickPool = variedIdx.length ? variedIdx : q.map((_, j) => j);
  const pickJ = pickPool[Math.floor(Math.random() * pickPool.length)];

  const nextPlace = q.splice(pickJ, 1)[0];
  const oldPlace = stops[visibleIndex];
  stops[visibleIndex] = nextPlace;
  q.push(oldPlace);

  planDayTaggedStops[activeDayIndex] = stops;
  return {
    planDayTaggedStops,
    planFlowRefreshQueue: q,
    routeItems: buildRouteItems(stops),
  };
}
```

---

## 11. Route Overview & Trip Save

### 11.1 Handoff to navigation

**File:** `route_overview_screen.dart`

Builds `routeLocationPoints` for `NavigationController`:

```javascript
const routeLocationPoints = [
  { name: 'Start', category: 'Start', lat: startLat, lng: startLng, visible: true },
  ...visibleRouteItems.map(r => ({ ...r, visible: true })),
];
```

Markers: `Start.png` + numbered pins `1.png`..`8.png` (one per stop, no duplicate destination pin).

### 11.2 Save trip

**File:** `createUserTrip` (1058) + `buildRoutesByDateFromDayRoutes` (2305)

```javascript
function buildRoutesByDateFromDayRoutes(dayRoutes, clickDates) {
  const routesByDate = {};
  for (const [dayIndex, routes] of Object.entries(dayRoutes)) {
    if (+dayIndex >= clickDates.length) continue;
    const dateKey = format(clickDates[dayIndex], 'yyyy-MM-dd');
    routesByDate[dateKey] = routes.filter(r => r.visible).map(r => ({ ...r }));
  }
  return routesByDate;
}

function getTripStatus(dates) {
  const today = startOfDay(new Date());
  return dates.some(d => isSameDay(d, today)) ? 'in-progress' : 'upcoming';
}
```

---

## 12. Map Navigation — Normal Stops & Mystery Boxes

**Controller:** `trip_rewards_controller.dart` + `navigation_controller.dart`

### 12.1 Box type per stop

```javascript
function getBoxTypeForStop(stopNumber) {
  return stopNumber % 2 !== 0 ? 'green' : 'golden';
}
// Stop 1 → green, 2 → golden, 3 → green, ...
```

### 12.2 Proximity UI zones

| Zone | Distance | UI |
|------|----------|-----|
| Far | > 200 m | No box |
| Lying | ≤ 200 m, > 42 m | Closed Lottie (green or golden) |
| Open | ≤ 42 m | Open Lottie + sound |

On **leg arrival** → `triggerNormalDestinationBox()` → `_playBoxAndAwardXP(boxType)`.

### 12.3 XP award + level-up

**File:** `level_progression_util.dart`

```javascript
const kLevelXpDifficultyMultiplier = 100;

function xpRequiredToAdvanceFromLevel(level) {
  return 100 * level * level;  // L1→L2 = 100, L2→L3 = 400
}

function applyEarnedXpWithLevelUps({ level, xpProgress, earnedXp }) {
  let lv = Math.max(1, level);
  let bank = Math.max(0, xpProgress) + Math.max(0, earnedXp);
  const startLevel = lv;
  while (bank >= xpRequiredToAdvanceFromLevel(lv)) {
    bank -= xpRequiredToAdvanceFromLevel(lv);
    lv += 1;
  }
  return { level: lv, xpProgress: bank, levelsGained: lv - startLevel };
}

function generateXP(boxType) {
  switch (boxType) {
    case 'green': return 1 + randomInt(50);      // 1-50
    case 'golden':
    case 'purple': return 51 + randomInt(50);   // 51-100
    default: return 10;
  }
}
```

### 12.4 Firestore write on award

```javascript
async function saveProgress(userId, boxType, xp, state) {
  const boxField = { green: 'green_boxes_count', golden: 'golden_boxes_count', purple: 'purple_boxes_count' }[boxType];
  await db.collection('users').doc(userId).set({
    [boxField]: FieldValue.increment(1),
    xp_earned: FieldValue.increment(xp),
    xp_progress: state.xpProgress,
    level: state.level,
    distance_covered_km: state.distanceCoveredKm,
  }, { merge: true });
}
```

### 12.5 Return home

**When:** All itinerary stops complete + user ≥ 8 m from `generatedStartPoint` + not in Surprise flow.

**Action:** `startReturnJourneyToPlanStart()` — route from current position → stay (Start.png pin).

---

## 13. Surprise Me Detour

**File:** `surprise_me_controller.dart`

### 13.1 Vibe → Firebase category

```javascript
function firebaseCategoryForVibeTitle(title) {
  const map = {
    Shopping: 'shopping', Party: 'party', Nature: 'nature', Culinary: 'culinary',
    Nightlife: 'party', Culture: 'shopping', Markets: 'culinary', Children: 'nature',
  };
  return map[title] || 'culinary';
}
```

### 13.2 Destination resolution order

**File:** `_resolveSurpriseDestination` (420+)

```
1. Reverse geocode user → city, country (title case)
2. Firestore: merchant_ads WHERE city, country, placeCategory, isActive=true, approvalStatus='approved'
3. Filter: distance 100m–1500m, stock available, not user-claimed
4. Prefer unshown session ads; nearest wins
5. Fallback: Google fetchSurpriseNearbyCandidates (radii 1800, 4000, 8000 m)
6. Fallback: random forward point 1km OR route geometry point OR midpoint ahead
```

### 13.3 Google Surprise fallback

**File:** `google_places_helper.dart` `fetchSurpriseNearbyCandidates` (696)

```javascript
async function fetchSurpriseNearbyCandidates(originLat, originLng, categoryKey, keywordOverride) {
  const keyword = keywordOverride || surpriseKeywordForCategory(categoryKey);
  // categoryKey → shopping: 'shopping mall clothing store', party: 'night club bar lounge', etc.
  const seen = new Set();
  const buf = [];
  for (const radius of [1800, 4000, 8000]) {
    const results = await placesNearby(originLat, originLng, radius, keyword);
    // dedupe by place_id, sort by haversine distance
    if (buf.length >= 12) break;
  }
  return buf.sort((a,b) => a.dist - b.dist);
}
```

### 13.4 Post-surprise navigation state

| Case | Behavior |
|------|----------|
| Itinerary already complete | Hold at surprise POI; show return-home CTA |
| Interrupted mid-leg | `awaitingSurpriseResumeToNext = true` → user taps **Resume** |
| Idle at stop | `useCurrentAvatarForNextMainLeg = true` → next **Start** from surprise position |
| No auto polyline | Main route cleared until user resumes |

### 13.5 Purple box / merchant deal

**At ≤50 m:** `runPurpleSurpriseMapFinale()`

- If Firebase ad with deal title → show deal sheet, `boxOpens++`, XP = 0
- Else → purple XP 51-100, `purple_boxes_count++`

---

## 14. Merchant Ads & Campaigns

**Collection:** `merchant_ads`  
**Service:** `lib/features/trip/screens/map_screen/helper/firebase_service.dart`

### 14.1 Queries

| Use case | Query |
|----------|-------|
| Surprise Me | `city`, `country`, `placeCategory`, `isActive==true`, `approvalStatus=='approved'` |
| Skip home banner | `city`, `isActive==true`, `approvalStatus=='approved'` |

### 14.2 Stock check

```javascript
function hasAvailableRewardStock(ad) {
  if (ad.stockLimit <= 0) return true;  // unlimited
  return ad.rewardClaims < ad.stockLimit;
}
```

### 14.3 Claim transaction (atomic)

**File:** `recordMerchantAdClaim` (200)

```
1. If users/{uid}/merchant_ad_claims/{adId} exists → alreadyClaimed
2. If ad inactive or stock depleted → soldOut
3. SET claim doc + INCREMENT merchant_ads.rewardClaims
4. If rewardClaims+1 >= stockLimit → set isActive=false
```

### 14.4 Banner rotation (skip home)

**File:** `merchant_sponsored_quest_controller.dart`

1. Load city ads with `imageUrl`, sort nearest-first.
2. Rotate unclaimed ads; if all claimed, show claimed with badge.
3. `recordBannerImpression` → subcollection `impressions` + parent `impressions++`.

---

## 15. Exploration Side Drops

**File:** `exploration_drops_controller.dart`

### 15.1 Spawn triggers

- Map ready → anchor = route start (exclude stop #1 pin)
- Each simulated leg complete → anchor = arrival position

### 15.2 Spawn algorithm

```javascript
async function refreshDropsNear(anchor, exclusionPoints, tripTags) {
  const keywords = explorationSideDropSearchKeywords(); // from trip_utils
  // 1. placesNearby 300m with vibe keywords
  // 2. Retry without exclusions
  // 3. Keyword-less nearby
  // 4. textSearch: 'point of interest', 'restaurant', 'cafe'

  // Filter: 12m–100m from anchor, not within 32m of route stops,
  //         48m separation between drops, max 2 drops
  // Drop[0].isGolden = false, Drop[1].isGolden = true
}
```

### 15.3 Pickup

At ≤ **5 m** → open animation 2.6s → `awardExplorationSideBox(golden, placeName)` → green or golden XP (does not affect main-route mystery flags).

---

## 16. Suggested REST API Endpoints

| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/v1/trips/generate/skip` | §8.1 | `{ skipFlowPlacePool, routeItems, dayRoutes }` |
| POST | `/v1/trips/generate/plan` | §9.1 | `{ planFlowPlacePool, planDayTaggedStops, planFlowRefreshQueue, dayRoutes }` |
| POST | `/v1/trips/refresh/skip` | `{ pool, visibleIndex, intenseMode }` | `{ pool, routeItems }` |
| POST | `/v1/trips/refresh/plan` | `{ planDayTaggedStops, refreshQueue, activeDayIndex, visibleIndex, tags, intenseMode }` | `{ planDayTaggedStops, refreshQueue, routeItems }` |
| POST | `/v1/places/search-breakpoints` | searchRouteBreakpoints params | `TaggedLocation[]` |
| POST | `/v1/ai/rank-locations` | rankLocationsWithAI params | `TaggedLocation[]` |
| POST | `/v1/surprise/resolve` | `{ lat, lng, vibeTitle, claimedAdIds[] }` | `{ position, adLocation?, placesFallbackName? }` |
| GET | `/v1/merchant-ads/banner` | `?city=&lat=&lng=` | `{ ad, distanceM, isClaimed }` |
| POST | `/v1/merchant-ads/{id}/impression` | `{ userId, source }` | 204 |
| POST | `/v1/merchant-ads/{id}/claim` | `{ userId }` | `{ result: success\|alreadyClaimed\|soldOut }` |
| POST | `/v1/exploration-drops/spawn` | `{ lat, lng, excludePins[], tags[] }` | `ExplorationSideDropModel[]` |
| POST | `/v1/rewards/award` | `{ userId, boxType, xp }` | `{ level, xpProgress, lifetimeXp }` |
| POST | `/v1/trips/save` | UserTripDocument fields | `{ tripId }` |

**Auth:** Firebase ID token in `Authorization: Bearer` (match existing Firestore rules).

**Secrets (server-side only):** `GOOGLE_PLACES_API_KEY`, `OPENAI_API_KEY`, `MAPBOX_TOKEN` (if backend builds polylines).

---

## 17. Source File Index

| Area | Path |
|------|------|
| Trip orchestration | `lib/features/trip/controllers/trip_controller.dart` |
| Skip helper | `lib/features/trip/controllers/skip_controller.dart` |
| Google Places search | `lib/features/trip/components/map_components/destination_point.dart` |
| Places HTTP | `lib/core/services/google_places_helper.dart` |
| OpenAI | `lib/core/services/openAi_service.dart` |
| Skip AI mix | `lib/core/utils/trip_utils/skip_flow_ai_candidate_mix.dart` |
| Tourist filter | `lib/core/utils/trip_utils/tourist_route_place_filter.dart` |
| Family filter | `lib/core/utils/trip_utils/family_friendly_plan_trip_filter.dart` |
| Level / XP | `lib/core/utils/trip_utils/level_progression_util.dart` |
| Navigation | `lib/features/general/controllers/navigation_controller.dart` |
| Rewards / boxes | `lib/features/trip/controllers/trip_rewards_controller.dart` |
| Surprise Me | `lib/features/trip/controllers/surprise_me_controller.dart` |
| Side drops | `lib/features/trip/controllers/exploration_drops_controller.dart` |
| Sponsored banner | `lib/features/trip/controllers/merchant_sponsored_quest_controller.dart` |
| Merchant Firestore | `lib/features/trip/screens/map_screen/helper/firebase_service.dart` |
| Ad model | `lib/features/trip/screens/map_screen/helper/adLocationModel.dart` |
| Route overview UI | `lib/features/trip/screens/map_screen/route_overview_screen.dart` |
| Map navigation UI | `lib/features/trip/screens/map_screen/map_navigation_screen.dart` |
| Loading / generate entry | `lib/features/trip/screens/vibe_module/loading_screen.dart` |
| Vibe swipe | `lib/features/trip/screens/vibe_module/vibe_screen.dart` |

---

## Appendix A — Dart Reference: `generateRoutes` dispatcher

```dart
// trip_controller.dart:1246
Future<void> generateRoutes() async {
  if (isGeneratingRoutes.value) return;
  isGeneratingRoutes.value = true;
  routesReady.value = false;
  try {
    if (tripFlowKind == TripFlowKind.planYourTrip) {
      await _generatePlanYourTripRoutes();
    } else {
      await _generateSkipFlowRoutes();
    }
    routesReady.value = true;
  } finally {
    isGeneratingRoutes.value = false;
  }
}
```

## Appendix B — Dart Reference: `rankLocationsWithAI` user payload

```dart
jsonEncode({
  "user_vibes": userTags,
  "mode": intenseMode ? "intense" : "relax",
  "candidates": candidates.asMap().entries.map((e) => {
    "index": e.key,
    "name": e.value.name,
    "category": e.value.category,
    "lat": e.value.lat,
    "lng": e.value.lng,
  }).toList(),
})
```

## Appendix C — Firestore indexes needed

```
merchant_ads: city, country, placeCategory, isActive, approvalStatus
merchant_ads: city, isActive, approvalStatus
users/{uid}/merchant_ad_claims/{adId}
users/{uid}/user_trips/{tripId}
merchant_ads/{adId}/impressions/{autoId}
```

---

*End of specification. For questions about Mapbox polyline generation or AR overlays, those remain client-side; backend only needs ordered `{lat,lng}` stop lists unless you choose to proxy Mapbox Directions.*

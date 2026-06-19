•
Wonder Trip - Backend Technical Specification
◦
◦
1. Executive summary
2. System architecture
What stays on the mobile app
What moves to backend
▪
▪
◦
3. Authentication & authorization
▪
▪
▪
▪
3.1 Auth providers
3.2 Recommended JWT session model
3.3 Firebase token exchange (Google / Apple)
3.4 Email signup OTP envelope (current shape)
◦
4. MongoDB data models
4.1 Collection: users
▪
▪
▪
▪
▪
▪
▪
▪
▪
4.2 Collection: trips
4.3 Collection: trip_generation_sessions (ephemeral)
4.4 Collection: merchant_ads
4.5 Collection: merchant_ad_impressions
4.6 Collection: merchant_ad_claims
4.7 Collection: reward_events (audit log - recommended)
4.8 Collection: avatars (catalog)
4.9 Collection: ai_chat_sessions (Trip AI assistant)
◦
5. Business logic the backend must implement
▪
5.1 Level / XP progression
▪
5.2 Trip generation - Skip flow
▪
5.3 Trip generation - Plan flow
▪
5.4 Vibe -> Places keyword map
▪
5.5 Route refresh
▪
▪
▪
▪
5.6 Surprise Me
5.7 Exploration drops
5.8 Squad invite
5.9 Live location (today vs sockets)
◦
6. REST API catalog
▪
▪
▪
▪
▪
▪
▪
▪
▪
6.1 Authentication - 13 endpoints
6.2 Users & profile - 7 endpoints
6.3 Trips & journal - 14 endpoints
6.4 Rewards & navigation events - 6 endpoints
6.5 Merchant ads - 8 endpoints
6.6 Places proxy (recommended) - 7 endpoints
6.7 AI proxy - 6 endpoints
6.8 Weather - 1 endpoint
6.9 Admin / merchant portal (not in mobile app - 8+ endpoints)
Page 1
◦
◦
◦
◦
◦
◦
◦
◦
◦
▪
6.10 File storage - 3 endpoints
7. WebSocket / Socket.io specification
▪
7.1 Rooms
▪
7.2 Client -> Server events
▪
7.3 Server -> Client events
▪
7.4 Socket flow diagram
8. Entity relationship diagram
9. App module -> API mapping
10. Environment variables (server-side)
11. Security & validation checklist
12. Migration notes & known gaps
13. API count summary
14. Suggested implementation phases
15. Open questions for your team
Wonder Trip - Backend Technical
Specification
Target stack: Node.js (API + WebSockets) · MongoDB · Hetzner (compute + object storage) · Flutter mobile
(unchanged UI)
Migration scope: Replace Firebase Firestore, Firebase Storage, and Cloud Functions. Firebase Auth
remains only as an OAuth bridge for Google/Apple (mobile sends Firebase ID token -> backend issues app
JWT).
This document is derived from the current Flutter codebase ( lib/features/*, functions/index.js) and
maps every persisted entity, API, socket event, and business rule the backend must implement.
1. Executive summary
Wonder Trip is a gamified travel app with:
Module What it does
Authentication Email/password + OTP, Google, Apple, forgot password
Profile Avatar selection (10 presets), XP/level/box stats
Skip flow GPS start -> 1 vibe -> AI-ranked 3-6 stops -> navigate
Plan flow Destination/hotel/dates/pace -> multi-vibe -> 1-4 days -> navigate
Map navigation Mapbox driving/walking, mystery boxes, return-to-stay
Surprise Me Sponsored detour (merchant ads or Google Places fallback)
Exploration drops Side-quest POIs within ~100 m
Page 2
Module What it does
Rewards Green/golden/purple boxes, XP, levels
Merchant ads Banner, Surprise Me, reward claims with stock limits
Adventure Journal Saved trips by status
Squad invite Deep link share of trip itinerary
Trip AI assistant OpenAI chat with trip context
Today: Firestore ( users, user_trips, merchant_ads) + Firebase Storage ( avatars/) + 2 Cloud Functions
(OTP email, password reset).
Tomorrow: All of the above via REST + WebSockets; files on Hetzner Object Storage (S3-compatible).
2. System architecture
flowchart TB
subgraph Mobile["Flutter App"]
UI[UI Screens]
Mapbox[Mapbox SDK - maps & directions]
Geo[Geolocator - GPS]
OAuth[Firebase Auth - Google/Apple only]
end
subgraph Hetzner["Hetzner Server"]
API[Node.js REST API]
WS[Socket.io Server]
Worker[Background Jobs - email, cron]
end
subgraph Data["Data Layer"]
Mongo[(MongoDB)]
S3[(Hetzner Object Storage)]
end
subgraph External["External - keys on server"]
OpenAI[OpenAI API]
GPlaces[Google Places API]
Weather[OpenWeather API]
SMTP[Email SMTP]
end
UI --> API
UI --> WS
Geo --> WS
OAuth -->|Firebase ID Token| API
API --> Mongo
API --> S3
API --> OpenAI
API --> GPlaces
API --> Weather
API --> SMTP
WS --> Mongo
Mapbox --> Mobile
Page 3
What stays on the mobile app
What moves to backend
Concern Stays client-side? Notes
Mapbox maps &
directions
Yes MAPBOX_TOKEN in app; polylines
rendered locally
Device GPS Yes Sent to backend via socket/REST
Firebase Auth (Google/
Apple)
Yes Token exchange only
Theme / locale /
onboarding prefs
Yes SharedPreferences / GetStorage
- not in Firestore today
Address search MRU Yes Local GetStorage key
trip_address_search_history_v1
Concern Today Backend
User accounts & progression Firestore users MongoDB users
Trips & journal Firestore user_trips MongoDB trips
Merchant ads & claims Firestore merchant_ads MongoDB merchant_ads +
merchant_ad_claims
Avatars & ad images Firebase Storage Hetzner avatars/, merchant-ads/
OTP email Cloud Function Node SMTP service
Password reset Cloud Function + Admin SDK Node bcrypt + JWT or Firebase Admin
verify
OpenAI calls Client .env Server-side proxy
Google Places (optional) Client Recommended: server proxy (hide API
key)
Live GPS sharing Firestore throttled writes WebSockets (primary) + optional REST
fallback
3. Authentication & authorization
3.1 Auth providers
Provider Mobile flow Backend responsibility
Email createUserWithEmailAndPassword
today
Full backend: register, hash password (bcrypt), issue
JWT
Google Google Sign-In -> Firebase credential Verify Firebase ID token -> upsert user -> issue app
JWT
Page 4
Provider Mobile flow Backend responsibility
Apple Sign in with Apple -> Firebase
credential
Same as Google
OTP (email verify) 6-digit code in Firestore + HTTP email Generate/store OTP in MongoDB, send email, verify
Forgot password OTP -> reset via Cloud Function OTP verify -> PATCH /auth/password/reset
3.2 Recommended JWT session model
{
"accessToken": "eyJ...",
"refreshToken": "eyJ...",
"expiresIn": 3600,
"user": { "id": "...", "email": "...", "isVerified": true }
}
Headers: Authorization: Bearer <accessToken>
3.3 Firebase token exchange (Google / Apple)
POST /api/v1/auth/oauth/firebase
Body: { "idToken": "<Firebase ID Token>", "provider": "google" | "apple" }
Backend steps: 1. Verify token with Firebase Admin SDK. 2. Extract uid, email, name, picture. 3. If user
missing -> create with authProvider, isVerified: true, default progression. 4. Return app JWT (use
MongoDB _id as canonical user id; store firebaseUid for reference).
3.4 Email signup OTP envelope (current shape)
{
"otp": {
"otpCode": "482910",
"createdAt": "ISO8601",
"updatedAt": "ISO8601",
"codeExpireTime": "ISO8601"
}
}
Note: OTP expiry check exists in code but is commented out - backend should enforce expiry (e.g. 10
minutes).
4. MongoDB data models
4.1 Collection: users
Replaces Firestore users/{uid}.
Page 5
{
_id: ObjectId,
// Identity
email: String, // unique, indexed
name: String,
passwordHash: String, // email provider only
authProvider: "email" | "google" | "apple",
firebaseUid: String, // OAuth users
photoUrl: String, // OAuth profile photo
isVerified: Boolean,
passwordResetVerified: Boolean,
// OTP (email signup / forgot password)
otp: {
otpCode: String,
createdAt: Date,
updatedAt: Date,
codeExpireTime: Date
},
// Avatar (URLs pointing to Hetzner)
avatarFrontUrl: String, // front view
avatarBackUrl: String, // map navigation back view
avatarUpdatedAt: Date,
selectedAvatarId: String, // "1".."10" - optional convenience
// Progression (snake_case preserved for mobile compatibility)
level: Number, // default 1
xp_earned: Number, // lifetime cumulative XP (monotonic)
xp_progress: Number, // remainder bank for level-ups
green_boxes_count: Number,
golden_boxes_count: Number,
purple_boxes_count: Number,
distance_covered_km: Number,
// Onboarding flags
has_seen_level_welcome: Boolean,
// Device tokens (future push)
fcmTokens: [String],
createdAt: Date,
updatedAt: Date
}
Indexes: email (unique), firebaseUid (sparse unique), authProvider
4.2 Collection: trips
Replaces Firestore users/{uid}/user_trips/{tripId}.
Page 6
{
_id: ObjectId,
userId: ObjectId, ownerUid: String, // ref users._id - indexed
// legacy Firebase uid if needed during migration
routeTitle: String,
destination: String, // address string
hotelLocation: String,
tripDates: [Date], // 1-4 consecutive days
status: "in-progress" | "upcoming" | "completed",
tripPace: Boolean, // false=relaxed (3 stops), true=intense (6)
radiusKm: Number,
travelWith: "Solo" | "Couple" | "Friends" | "Family",
interestedVibes: [String], // e.g. ["Nightlife","Culinary"]
imageUrls: [String], // loading carousel photo URLs
// Per-day visible stops only (keys: "yyyy-MM-dd")
routesByDate: {
"2026-06-09": [
{
index: Number,
name: String,
category: String,
lat: Number,
lng: Number,
visible: Boolean // always true in saved docs
}
]
},
// Squad sharing
isShared: Boolean, inviteToken: String, // true for squad invite snapshots
// base64url(ownerId|tripId) - optional cache
// Live navigation (today: Firestore throttled writes)
currentLatitude: Number,
currentLongitude: Number,
lastLocationUpdatedAt: Date,
heading: Number, // optional - for squad AR
navStatus: "idle" | "navigating" | "paused", // socket-enhanced
// Flow metadata (useful for refresh/regen)
flowKind: "skip" | "planYourTrip",
generatedStartPoint: { lat: Number, lng: Number },
generatedDestinationPoint: { lat: Number, lng: Number },
createdAt: Date,
updatedAt: Date
}
Indexes: - { userId: 1, status: 1, createdAt: -1 } - Adventure Journal - { isShared: 1 } - squad reads
- { userId: 1, lastLocationUpdatedAt: -1 } - live tracking
Status logic (must implement on server):
Condition Status
Any tripDates is today in-progress
All dates in future upcoming
All dates in past completed
Page 7
Gap in current app: completed is shown in Journal UI but never written to Firestore. Backend should
auto-transition via cron or on read.
4.3 Collection: trip_generation_sessions (ephemeral)
Stores in-memory pools during route building (not persisted in Firestore today). Needed if generation moves
server-side.
{
_id: ObjectId,
userId: ObjectId,
flowKind: "skip" | "planYourTrip",
likedVibes: [String],
visibleK: Number, // 3 or 6
skipFlowPlacePool: [TaggedLocation], // skip: ~15-20 POIs
planFlowPlacePool: [TaggedLocation], // plan: ~100 cap
planDayTaggedStops: { "0": [TaggedLocation], "1": [...] },
planFlowRefreshQueue: [TaggedLocation],
dayRoutes: { "0": [RouteItem], ... },
expiresAt: Date // TTL index - 24h
}
Embedded TaggedLocation:
{
name: String,
category: String,
lat: Number,
lng: Number,
visible: Boolean,
isSurprise: Boolean,
googleTypes: [String] // optional
}
4.4 Collection: merchant_ads
Replaces Firestore merchant_ads/{adId}.
Page 8
{
_id: ObjectId,
merchantId: String,
merchantName: String,
adTitle: String,
descriptionText: String,
latitude: Number,
longitude: Number,
city: String, // indexed
country: String,
address: String,
adType: String, // e.g. "text"
placeCategory: String, // vibe filter for Surprise Me - indexed
imageUrl: String, // Hetzner URL
logoUrl: String,
isActive: Boolean,
approvalStatus: "pending" | "approved" | "rejected",
stockLimit: Number, rewardClaims: Number,
// 0 or negative = unlimited
// Analytics counters
impressions: Number,
boxOpens: Number,
createdAt: Date,
updatedAt: Date
}
Indexes: - { city: 1, country: 1, placeCategory: 1, isActive: 1, approvalStatus: 1 } - Surprise Me -
{ city: 1, isActive: 1, approvalStatus: 1 } - home banner
4.5 Collection: merchant_ad_impressions
Replaces subcollection merchant_ads/{id}/impressions.
{
_id: ObjectId,
merchantAdId: ObjectId,
userId: ObjectId,
viewedAt: Date,
source: "skip_home_banner" | "plan_banner" | "surprise_me"
}
4.6 Collection: merchant_ad_claims
Replaces users/{uid}/merchant_ad_claims/{adId}.
Page 9
{
_id: ObjectId,
userId: ObjectId, // indexed
merchantAdId: ObjectId, // unique compound with userId
merchantId: String,
merchantName: String,
adTitle: String,
city: String,
country: String,
address: String,
latitude: Number,
longitude: Number,
claimedAt: Date
}
Unique index: { userId: 1, merchantAdId: 1 }
Claim transaction rules (from firebase_service.dart): 1. Reject if user already claimed this ad. 2. Reject if
ad inactive or rewardClaims >= stockLimit (when stockLimit > 0). 3. Insert claim + increment
merchant_ads.rewardClaims. 4. If rewardClaims + 1 >= stockLimit -> set isActive: false.
4.7 Collection: reward_events (audit log - recommended)
Not in Firestore today; add for anti-cheat and debugging.
{
_id: ObjectId,
userId: ObjectId,
tripId: ObjectId,
eventType: "green_box" | "golden_box" | "purple_box" | "exploration_drop",
xpAwarded: Number,
boxType: String,
stopIndex: Number,
placeName: String,
merchantAdId: ObjectId, // optional
location: { lat: Number, lng: Number },
createdAt: Date
}
4.8 Collection: avatars (catalog)
Replaces Firebase Storage listing + hardcoded IDs 1- 10.
{
_id: ObjectId,
avatarId: String, // "1".."10"
frontUrl: String, // Hetzner: avatars/1_front.png
backUrl: String, // Hetzner: avatars/1_back.png
requiredLevel: Number, // see unlock rules below
sortOrder: Number
}
Avatar unlock rules:
Page 10
Carousel index Required level
0, 1 1
2 2
3 3
n n (index >= 2)
4.9 Collection: ai_chat_sessions (Trip AI assistant)
{
_id: ObjectId,
userId: ObjectId,
tripId: ObjectId,
messages: [
{ role: "user" | "assistant", content: String, createdAt: Date }
],
tripContextSnapshot: Object, // frozen at session start
createdAt: Date,
updatedAt: Date
}
5. Business logic the backend must implement
5.1 Level / XP progression
Formula: XP to advance from level L -> L+1 = 100 × L²
Level transition XP required
1 -> 2 100
2 -> 3 400
3 -> 4 900
Fields: - xp_earned - lifetime total (only increases). - xp_progress - bank consumed by level-up loop.
XP per box (server-generated random):
Box XP range
Green 1-50
Golden 51-100
Purple 51-100 (0 if merchant deal sheet)
Box assignment on main route: odd stops -> green, even -> golden.
Level-up: Run applyEarnedXpWithLevelUps logic server-side after each award; return
{ level, xpProgress, levelsGained } to client.
Page 11
5.2 Trip generation - Skip flow
Input: current GPS, 1 vibe, pace (K=3 or 6), radius.
Steps: 1. Expand vibe -> Google Places keywords via tagWikiKeywords map (see §5.4). 2.
searchRouteBreakpoints - target ~20 unique POIs. 3. Pass up to ~30 candidates to OpenAI
rankLocationsWithAI. 4. Build skipFlowPlacePool (15-20). 5. Return first K as visible itinerary + full pool for
refresh.
5.3 Trip generation - Plan flow
Input: destination, hotel, 1-4 dates, pace, radius, travel party, multiple liked vibes.
Differences from skip: - Start anchor: hotel -> destination -> GPS fallback. -
_fairInterleavedSearchKeywords - round-robin one keyword per vibe. -
ensureAllKeywordsSearchedAtFirstRadius: true on first radius pass. - Chunked AI ranking (~28 candidates
per chunk). - _buildPlanFlowMasterPool - vibe buckets, shuffled head for diversity. -
_partitionPlanFlowPoolIntoDays - K stops per day + shared planFlowRefreshQueue.
5.4 Vibe -> Places keyword map
Backend should store this as config (currently in trip_controller.dart):
Vibe Sample keywords
Nightlife night club, rooftop bar, cocktail bar, jazz club, …
Children playground, zoo, aquarium, theme park, …
Culinary restaurant, cafe, street food, bakery, … (40+ keywords)
Party night club, dance club, karaoke bar, …
Shopping boutique, shopping mall, department store, …
Nature park, lake, national park, beach, hiking trail, …
Markets farmers market, street market, flea market, …
Culture museum, art gallery, theatre, historical site, …
Skip home grid vibes: Shopping, Party, Nature, Culinary.
5.5 Route refresh
Flow Endpoint behavior
Skip Swap slot i with POI at pool index K; push replaced POI to end of pool
Plan Swap slot on activeDayIndex from planFlowRefreshQueue; prefer different primary
vibe
Page 12
5.6 Surprise Me
1.
2.
3.
4.
5.
Query merchant_ads by city + country + placeCategory + isActive + approved.
Fallback: Google Places fetchSurpriseNearbyCandidates.
On purple box open: increment boxOpens.
Merchant deal: no XP; show deal sheet.
Claim: transactional merchant_ad_claims.
5.7 Exploration drops
•
•
•
Max 2 side POIs within ~100 m (vibe keywords).
Pickup at ~5 m -> award exploration side box (does not touch main mystery flags).
Session-only today - backend can log in reward_events.
5.8 Squad invite
Token format: base64url(utf8("${ownerUserId}|${tripId}")) without = padding.
Share URL: https://<your-domain>/join/{token}
Deep link paths: /join/{token} (Android App Links + iOS Universal Links).
Read rules: Invitee can read trip where isShared === true.
5.9 Live location (today vs sockets)
Current Firestore throttle: - Write at most every 10 seconds OR when moved >= 25 m.
Recommended socket + optional REST:
Socket emit: trip:location:update
{ tripId, lat, lng, heading?, speed?, timestamp }
Server broadcasts to squad room members subscribed to that trip.
6. REST API catalog
Base URL: https://api.<domain>/api/v1
Total: ~62 endpoints (including recommended admin + AI proxy).
Page 13
6.1 Authentication - 13 endpoints
# Method Endpoint 1 POST /auth/register 2 POST /auth/login 3 POST /auth/oauth/firebase 4 POST /auth/otp/send 5 POST /auth/otp/verify 6 POST /auth/password/forgot 7 POST /auth/password/verify-otp 8 POST /auth/password/reset 9 POST /auth/logout 10 POST /auth/refresh 11 GET /auth/me 12 DELETE /auth/account 13 POST /auth/logout-all 6.2 Users & profile - 7 endpoints
# Method Endpoint 14 GET /users/me 15 PATCH /users/me/avatar 16 PATCH /users/me/level-welcome 17 GET /users/me/progression 18 GET /avatars 19 POST /users/me/fcm-token 20 DELETE /users/me/fcm-token Purpose
Email signup -> create user + send
OTP
Email login -> JWT (block if !
isVerified)
Google/Apple Firebase token ->
JWT
Resend signup OTP
Verify email OTP ->
isVerified: true
Send reset OTP to email
Verify reset OTP
Set new password
Invalidate refresh token
Refresh access token
Current user profile stub
GDPR account deletion
(recommended)
Revoke all sessions
(recommended)
Purpose
Full profile + progression stats
Save { avatarFrontUrl,
avatarBackUrl, avatarId }
Set has_seen_level_welcome:
true
Level, XP, boxes, distance
Avatar catalog with unlock levels
Register push token (future)
Unregister push token
Page 14
6.3 Trips & journal - 14 endpoints
# Method Endpoint 21 POST /trips/generate/skip 22 POST /trips/generate/plan 23 POST /trips 24 GET /trips 25 GET /trips/:tripId 26 PATCH /trips/:tripId 27 PATCH /trips/:tripId/status 28 DELETE /trips/:tripId 29 POST /trips/:tripId/refresh-slot 30 POST /trips/:tripId/live-location 31 POST /trips/:tripId/share 32 GET /trips/shared/:token 33 GET /trips/:tripId/day/:dateKey/
routes
34 POST /trips/:tripId/complete POST /trips/generate/skip request example:
{
"lat": 48.8566,
"lng": 2.3522,
"vibes": ["Culinary"],
"isPace": false,
"radiusKm": 5,
"locale": "en"
}
POST /trips request example:
Purpose
Generate skip-flow routes
Generate plan-flow routes
Save trip ( createUserTrip)
List trips
?status=in-progress\|
upcoming\|completed
Single trip detail
Update metadata
Manual/auto status transition
Delete trip
Skip/plan pool refresh
{ dayIndex, slotIndex }
REST fallback for GPS update
Create isShared copy + return
invite URL
Resolve squad invite (public/semi-
public)
Routes for one day tab
Mark completed when itinerary
done
Page 15
{
"routeTitle": "Paris Food Tour",
"destination": "Paris, France",
"hotelLocation": "Hotel Example",
"tripDates": ["2026-06-09"],
"tripPace": false,
"radiusKm": 5,
"travelWith": "Solo",
"interestedVibes": ["Culinary"],
"imageUrls": ["https://..."],
"routesByDate": { "2026-06-09": [{ "index": 1, "name": "...", "category": "...", "lat": 0,
"lng": 0, "visible": true }] },
"flowKind": "skip",
"generatedStartPoint": { "lat": 48.85, "lng": 2.35 },
"startNavigation": false
}
6.4 Rewards & navigation events - 6 endpoints
# Method Endpoint Purpose
35 POST /rewards/box-open Award box XP { tripId,
stopIndex, boxType, lat,
lng }
36 POST /rewards/exploration-drop Side-quest pickup award
37 POST /rewards/surprise-complete Purple box / Surprise Me complete
38 PATCH /users/me/distance Update distance_covered_km
during nav
39 GET /rewards/history Paginated reward_events
40 POST /rewards/validate-proximity Server-side distance check before
award (anti-cheat)
Important: Box awards should be server-validated (user within ~50 m of waypoint) - client currently
trusts GPS locally.
6.5 Merchant ads - 8 endpoints
# Method Endpoint Purpose
41 GET /merchant-ads/surprise ?
city=&country=&placeCategory=
42 GET /merchant-ads/banner ?city=
43 POST /merchant-ads/:adId/
impressions
Record banner view
44 POST /merchant-ads/:adId/box-opens Surprise Me open counter
45 POST /merchant-ads/:adId/claims Transactional reward claim
Page 16
# Method Endpoint Purpose
46 GET /users/me/merchant-claims Set of claimed ad IDs
47 GET /merchant-ads/:adId Single ad detail
48 GET /merchant-ads/:adId/stock Stock availability check
6.6 Places proxy (recommended) - 7 endpoints
# Method Endpoint Purpose
49 GET /places/autocomplete ?input=&language=
50 GET /places/details ?placeId=&fields=
51 GET /places/nearby ?lat=&lng=&radius=&keyword=
52 GET /places/text-search ?query=&lat=&lng=&radius=
53 GET /geocode/reverse ?lat=&lng=
54 GET /geocode/forward ?address=
55 GET /places/photo Proxy photo URL (hide API key)
6.7 AI proxy - 6 endpoints
# Method Endpoint OpenAI model Purpose
56 POST /ai/rank-locations gpt-4o-mini Rank POI candidates
57 POST /ai/loading-texts gpt-3.5-turbo 10 loading lines
58 POST /ai/city-vibe-
suggestions
gpt-4o-mini 3 lifestyle suggestions
59 POST /ai/place-highlight gpt-4o-mini Place description blurb
60 POST /ai/trip-assistant/
chat
gpt-4o-mini Map nav copilot
61 POST /ai/prompt-short gpt-3.5-turbo Short interest prompt
POST /ai/rank-locations body:
{
"user_vibes": ["Nightlife", "Culinary"],
"mode": "plan",
"candidates": [
{ "index": 0, "name": "...", "category": "...", "lat": 0, "lng": 0 }
],
"locale": "en"
}
Response: { "order": [3, 1, 0, 2, ...] }
Page 17
6.8 Weather - 1 endpoint
# Method Endpoint Purpose
62 GET /weather/current ?lat=&lng= -> OpenWeather proxy
6.9 Admin / merchant portal (not in mobile app - 8+ endpoints)
Method Endpoint Purpose
POST /admin/merchant-ads Create campaign
PATCH /admin/merchant-ads/:id Update ad
PATCH /admin/merchant-ads/:id/approve Approve/reject
GET /admin/merchant-ads List with filters
GET /admin/analytics/impressions Dashboard
POST /admin/avatars Upload new avatar assets
GET /admin/users User management
GET /admin/trips Trip oversight
6.10 File storage - 3 endpoints
Method Endpoint Purpose
GET /storage/avatars/:id/:view Public avatar PNG ( front/ back)
POST /storage/upload Signed upload URL (admin/merchant)
GET /storage/signed-url Temporary read URL for private assets
Hetzner paths (S3-compatible):
avatars/{id}_front.png
avatars/{id}_back.png
merchant-ads/{adId}/image.jpg
merchant-ads/{adId}/logo.jpg
trip-exports/{userId}/{tripId}.pdf (optional)
7. WebSocket / Socket.io specification
Connection: wss://api.<domain> with JWT in handshake auth: { token }.
Page 18
7.1 Rooms
Room name Members user:{userId} Owner trip:{tripId} Owner + squad viewers squad:{tripId} Invitees who joined 7.2 Client -> Server events
Event Payload trip:join { tripId } trip:leave { tripId } trip:location:update { tripId, lat, lng, heading?,
speed?, accuracy? }
trip:nav:status { tripId, status:
"idle"\|"navigating"\|"paused",
currentStopIndex }
trip:stop:reached { tripId, stopIndex, lat, lng } squad:join { inviteToken } squad:presence { tripId, displayName?,
avatarFrontUrl? }
7.3 Server -> Client events
Event Payload trip:location:broadcast { userId, lat, lng, heading,
timestamp }
trip:nav:updated { tripId, status,
currentStopIndex }
rewards:box:awarded { boxType, xp, level,
levelsGained }
rewards:level:up { newLevel } merchant:stock:depleted { adId } trip:status:changed { tripId, status } squad:member:joined { userId, name } Purpose
Personal notifications
Live GPS & nav status
Shared journey tracking
Purpose
Subscribe to trip room
Unsubscribe
Live GPS (throttle server-side: 10s / 25m)
Nav state
Waypoint arrival -> trigger box validation
Join squad room after deep link
Member online
Purpose
Squad sees owner moving
Nav state sync
Real-time XP popup data
Level celebration trigger
Campaign sold out
Journal status updates
Presence notification
Page 19
7.4 Socket flow diagram
sequenceDiagram
participant App as Flutter App
participant WS as Socket.io Server
participant DB as MongoDB
participant Squad as Squad Member App
App->>WS: connect(JWT)
App->>WS: trip:join(tripId)
loop Every GPS tick throttled
App->>WS: trip:location:update
WS->>DB: upsert trips.currentLat/Lng
WS->>Squad: trip:location:broadcast
end
App->>WS: trip:stop:reached
WS->>WS: validate proximity
WS->>DB: award XP + box
WS->>App: rewards:box:awarded
8. Entity relationship diagram
erDiagram
USERS ||--o{ TRIPS : owns
USERS ||--o{ MERCHANT_AD_CLAIMS : claims
USERS ||--o{ REWARD_EVENTS : earns
USERS ||--o{ AI_CHAT_SESSIONS : chats
MERCHANT_ADS ||--o{ MERCHANT_AD_IMPRESSIONS : tracks
MERCHANT_ADS ||--o{ MERCHANT_AD_CLAIMS : redeemed
TRIPS ||--o{ REWARD_EVENTS : generates
TRIPS ||--o{ AI_CHAT_SESSIONS : context
AVATARS ||--o{ USERS : selected_by
USERS {
ObjectId _id
string email
string authProvider
int level
int xp_earned
int xp_progress
}
TRIPS {
ObjectId _id
ObjectId userId
string status
boolean isShared
object routesByDate
}
MERCHANT_ADS {
ObjectId _id
string city
string placeCategory
int stockLimit
int rewardClaims
}
Page 20
9. App module -> API mapping
Flutter screen / controller Backend APIs + sockets
auth_controller.dart Auth §6.1
profile_controller.dart Users §6.2, /avatars
level_celebration_screen.dart PATCH /users/me/level-welcome
trip_controller.dart Trips §6.3, generation, refresh, live location
navigation_controller.dart Sockets trip:location:*, trip:nav:*, rewards
trip_rewards_controller.dart /rewards/*, progression updates
surprise_me_controller.dart /merchant-ads/surprise, /rewards/surprise-
complete
exploration_drops_controller.dart /rewards/exploration-drop
merchant_sponsored_quest_controller.dart /merchant-ads/banner, impressions, claims
adventure_journal_screen.dart GET /trips?status= (+ socket for live updates)
squad_invite_controller.dart +
squad_map_screen.dart
/trips/shared/:token, squad sockets
trip_ai_assistant_controller.dart /ai/trip-assistant/chat
skip_controller.dart / home_controller.dart /trips/generate/skip, /weather/current
destination_point.dart /places/* proxy
openAi_service.dart /ai/* proxy
avatar_options_service.dart /avatars, Hetzner storage
trip_export_controller.dart Client PDF (optional server /trips/:id/export)
10. Environment variables (server-side)
Variable Purpose
MONGODB_URI Database connection
JWT_SECRET / JWT_REFRESH_SECRET App tokens
FIREBASE_ADMIN_SDK_JSON Verify Google/Apple ID tokens
GOOGLE_PLACES_API_KEY Places proxy
OPENAI_API_KEY AI proxy
OPENWEATHER_API_KEY Weather
MAPBOX_TOKEN Optional server-side geocoding
HETZNER_S3_ENDPOINT Object storage
Page 21
Variable Purpose
HETZNER_S3_ACCESS_KEY Storage credentials
HETZNER_S3_SECRET_KEY Storage credentials
HETZNER_S3_BUCKET Bucket name
SMTP_HOST / SMTP_USER / SMTP_PASS OTP emails
APP_BASE_URL Deep links https://<domain>/join/
CORS_ORIGINS Mobile + admin
Mobile keeps only: MAPBOX_TOKEN (maps), Firebase config (OAuth), API base URL, Socket URL.
11. Security & validation checklist
Rule Implementation
JWT on all protected routes Middleware
Rate-limit auth & OTP Redis or in-memory
Proximity validation for box
awards
Haversine <= 50 m of waypoint
Merchant claim atomicity MongoDB transaction (like Firestore runTransaction)
isShared trips readable by
token only
No PII leak; trip snapshot only
Hide third-party API keys All Places/OpenAI/Weather server-side
Input validation Zod/Joi on all POST bodies
CORS + HTTPS only Production Hetzner
12. Migration notes & known gaps
Item Current state Backend action
Trip completed
status
UI filter exists; never written Cron: past dates -> completed
FCM push Stub only
( firebase_notification_service.dart)
Implement when ready
Pharmacy POIs Logic exists; no API wired Optional future feature
Email auth Uses Firebase Auth today Decide: keep Firebase for email OR full backend
bcrypt
verifyEmailOtp
callable
Referenced but not deployed Replace with REST OTP
Page 22
Item Current state Backend action
Trip generation
pools
In-memory on device trip_generation_sessions collection
Real-time squad
GPS
Not implemented (one-time Firestore read) Sockets - primary new feature
Admin merchant
portal
Data in Firestore manually Build admin APIs
13. API count summary
Module Endpoints
Authentication 13
Users & profile 7
Trips & journal 14
Rewards & navigation 6
Merchant ads 8
Places proxy 7
AI proxy 6
Weather 1
Mobile-facing total 62
Admin (merchant portal) 8+
Storage helpers 3
Grand total ~73
Socket events: 7 client -> server, 7 server -> client, 3 room types.
Page 23
14. Suggested implementation phases
gantt
title Wonder Trip Backend Rollout
dateFormat YYYY-MM-DD
section Phase 1
Auth + Users + JWT Hetzner storage + avatars :p1, 2026-06-10, 14d
:p1b, 2026-06-10, 7d
section Phase 2
Trips CRUD + journal Trip generation + AI proxy :p2, 2026-06-24, 14d
:p2b, 2026-06-24, 21d
section Phase 3
Rewards + merchant ads WebSockets live GPS :p3, 2026-07-15, 14d
:p3b, 2026-07-15, 14d
section Phase 4
Squad + deep links :p4, 2026-07-29, 7d
Admin portal :p4b, 2026-07-29, 14d
15. Open questions for your team
1.
2.
3.
4.
5.
Email auth: Full backend (bcrypt + JWT) or keep Firebase Auth for email too?
Trip generation: Server-only (recommended) or hybrid (Places on client, ranking on server)?
Mapbox Directions: Stay on device or proxy through backend?
Squad real-time: Owner-only GPS broadcast, or multi-member GPS when squad grows?
Merchant admin: Separate web dashboard or manual MongoDB seeding for launch?
This specification covers every Firestore collection, field, Cloud Function, business rule, and controller
persistence path found in the current Wonder Trip codebase.
Page 24
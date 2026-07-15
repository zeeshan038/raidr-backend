//NPM Pkgs
import crypto from "crypto";

//Schema
import { PlanYourTripSchema, SkipTripSchema, StartAndPauseTripSchema, SaveJourneySchema } from "../schema/Trip.js"

// Prisma Client
import { prisma } from "../config/db.js"

//Service
import { searchRouteBreakpoints, fetchSurpriseNearbyCandidates } from "../services/googlePlaces.js"

//Utils
import { rankPlanCandidatesChunked, rankLocationsWithAI, generateCityVibeSuggestions, generateLoadingTexts } from "../utils/Openai.js"
import {
    expandTags,
    fairInterleavedSearchKeywords,
    buildPlanFlowMasterPool,
    partitionPlanFlowPoolIntoDays,
    isRealPoi,
    mixedCandidatesForSkipAiBatch,
    isNonTouristRoutePlace,
    isPlaceInappropriateForFamilyTrip,
    interleavePlanRawForChunkDiversity,
    resolveStartPointForPlan
} from "../utils/tripUtils.js"
import { haversineDistance, generateDynamicXP } from "../utils/methods/methods.js"


/**
 * @Description Plan you trip
 * @Route POST /trip/plan
 * @Access Private
 */
export const PlanYourTrip = async (req, res) => {
    const { id } = req.user;
    const payload = req.body;

    const result = PlanYourTripSchema(payload)
    if (result.error) {
        return res.status(400).json({
            status: false,
            msg: result.error.message
        })
    }

    try {
        const resolvedStart = resolveStartPointForPlan({
            hotelLat: payload.hotelLat,
            hotelLng: payload.hotelLng,
            destinationLat: payload.destinationLat,
            destinationLng: payload.destinationLng,
        });

        if (!resolvedStart) {
            return res.status(400).json({
                status: false,
                msg: 'At least one of hotel or destination coordinates is required'
            });
        }

        const { lat: searchLat, lng: searchLng } = resolvedStart;
        const intenseMode = payload.intenseMode || false;

        const tripFromDate = new Date(payload.tripFrom);
        const tripToDate = new Date(payload.tripTo);
        const timeDiff = Math.abs(tripToDate.getTime() - tripFromDate.getTime());
        const totalDays = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;

        const generatedDates = [];
        for (let i = 0; i < totalDays; i++) {
            const nextDate = new Date(tripFromDate);
            nextDate.setDate(tripFromDate.getDate() + i);
            generatedDates.push(nextDate.toISOString());
        }

        const visibleK = intenseMode ? 6 : 3;

        // Extract vibe strings
        const likedTitles = payload.interestedVibes || [];
        const keywordTags = expandTags(likedTitles);
        const searchKeywords = fairInterleavedSearchKeywords(likedTitles);

        // Handle travelWith array 
        const familyPartyPlan = payload.travelWith && payload.travelWith.includes("Family");

        // Google Places Search
        let rawLocations = await searchRouteBreakpoints({
            startLat: searchLat,
            startLng: searchLng,
            radiusKm: payload.radiusKm || 10,
            keywords: searchKeywords,
            targetPoolSize: 50,
            minCandidatesOverride: familyPartyPlan ? 128 : 80,
            ensureAllKeywordsSearchedAtFirstRadius: true
        });
        // Apply spec filters
        rawLocations = rawLocations.filter(isRealPoi).filter(l => !isNonTouristRoutePlace(l));
        if (familyPartyPlan) {
            rawLocations = rawLocations.filter(l => !isPlaceInappropriateForFamilyTrip(l));
        }

        // Limit candidates to send to AI
        rawLocations = rawLocations.slice(0, 130);

        // Interleave for chunk diversity
        rawLocations = interleavePlanRawForChunkDiversity(rawLocations, likedTitles);

        // OpenAI Ranking
        const rankedCandidates = await rankPlanCandidatesChunked(rawLocations, keywordTags, likedTitles.length > 1, intenseMode);

        // Build Master Pool
        const masterPool = buildPlanFlowMasterPool(rankedCandidates, likedTitles, visibleK);

        // Partition into Days
        const { planDayTaggedStops, planFlowRefreshQueue } = partitionPlanFlowPoolIntoDays(masterPool, totalDays, visibleK);

        // Map routes
        const dayRoutes = {};
        for (let d = 0; d < totalDays; d++) {
            dayRoutes[d] = (planDayTaggedStops[d] || []).map((s, i) => ({
                index: i + 1,
                name: s.name,
                category: s.category,
                lat: s.lat,
                lng: s.lng,
                isAchieved: false,
                xpReward: generateDynamicXP(s.isSurprise ?? false)
            }));
        }

        const formattedRefreshQueue = planFlowRefreshQueue.slice(0, 20).map((s, i) => ({
            index: i + 1,
            name: s.name,
            category: s.category,
            lat: s.lat,
            lng: s.lng,
            isAchieved: false,
            xpReward: generateDynamicXP(s.isSurprise ?? false)
        }));

        const createTrip = await prisma.trip.create({
            data: {
                destination: payload.destination,
                hotelLocation: payload.hotelLocation,
                hotelLat: payload.hotelLat,
                hotelLng: payload.hotelLng,
                destinationLat: payload.destinationLat,
                destinationLng: payload.destinationLng,
                tripDates: generatedDates,
                radiusKm: payload.radiusKm,
                tripPace: intenseMode,
                travelWith: Array.isArray(payload.travelWith) ? payload.travelWith[0] : payload.travelWith,
                interestedVibes: payload.interestedVibes,
                flowKind: 'planYourTrip',
                user: {
                    connect: {
                        id: id
                    }
                }
            }
        })

        const { currentLatitude, currentLongitude, lastLocationUpdatedAt, ...tripData } = createTrip;

        return res.status(201).json({
            status: true,
            msg: "Trip planned successfully",
            trip: tripData,
            generatedRoutes: {
                dayRoutes,
                refreshQueue: formattedRefreshQueue
            }
        })
    } catch (error) {
        console.log(error)
        res.status(500).json({
            status: false,
            msg: error.message
        })
    }
}

/**
 * @Description Get cty Wheater and pictures
 * @Route GET /trip/weather
 * @Access Private
 */
export const GetCityWeather = async (req, res) => {
    const { lat, lng } = req.query;

    if (!lat || !lng) {
        return res.status(400).json({ status: false, msg: "Latitude and longitude are required" });
    }

    try {
        const weatherApiKey = process.env.OPENWEATHER_API_KEY;
        const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${weatherApiKey}&units=metric`;

        const weatherRes = await fetch(weatherUrl);
        const weatherData = await weatherRes.json();

        if (!weatherRes.ok) {
            return res.status(400).json({ status: false, msg: weatherData.message || "Failed to fetch weather" });
        }

        const placesApiKey = process.env.GOOGLE_PLACES_API_KEY;
        let imageUrls = [];

        const query = weatherData.name;
        let placesUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent("popular tourist attractions in " + query)}&key=${placesApiKey}`;

        let placesRes = await fetch(placesUrl);
        let placesData = await placesRes.json();

        if (!placesData.results || placesData.results.length === 0) {
            placesUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent("popular tourist attractions")}&location=${lat},${lng}&radius=50000&key=${placesApiKey}`;
            placesRes = await fetch(placesUrl);
            placesData = await placesRes.json();
        }

        if (placesData.results && placesData.results.length > 0) {
            const photos = [];
            placesData.results.forEach(place => {
                if (place.photos) {
                    photos.push(...place.photos);
                }
            });
            imageUrls = photos.slice(0, 5).map(photo => {
                return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${photo.photo_reference}&key=${placesApiKey}`;
            });
        }

        const [factText, loadingText] = await Promise.all([
            generateCityVibeSuggestions({
                city: weatherData.name,
                country: weatherData.sys?.country || '',
                interestedVibes: ['food', 'nightlife', 'coffee'],
                languageCode: 'en'
            }),
            generateLoadingTexts({
                userVibes: [],
                languageCode: 'en'
            })
        ]);

        return res.status(200).json({
            status: true,
            msg: "Weather and images fetched successfully",
            weather: weatherData,
            images: imageUrls,
            factText,
            loadingText
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status: false,
            msg: error.message
        });
    }
}

/**
 * @Description Skip Your Trip (Quick 1-day trip from current GPS)
 * @Route POST /trip/skip-trip
 * @Access Private
 */
export const SkipYourTrip = async (req, res) => {
    const { id } = req.user;
    const payload = req.body;

    const result = SkipTripSchema(payload);
    if (result.error) {
        return res.status(400).json({
            status: false,
            msg: result.error.message
        });
    }

    try {
        const startLat = payload.startLat || 25.20;
        const startLng = payload.startLng || 55.27;
        const intenseMode = payload.intenseMode || true;
        const radiusKm = payload.radiusKm || 2.0;
        const tags = payload.tags || [];
        const visibleK = intenseMode ? 6 : 3;

        // Extract vibe strings
        const keywords = expandTags(tags.length ? tags : ['Nightlife', 'Nature', 'Shopping', 'Children', 'Culinary']);

        // Google Places Search
        let rawLocations = await searchRouteBreakpoints({
            startLat,
            startLng,
            radiusKm,
            numBreakpoints: visibleK,
            keywords,
            targetPoolSize: 20
        });

        // Filter locations
        rawLocations = rawLocations.filter(l => !isNonTouristRoutePlace(l));

        // AI Batching Strategy
        const skipSingleHomeVibe = tags.length === 1 && ['Shopping', 'Party', 'Nature', 'Culinary'].includes(tags[0])
            ? tags[0] : null;

        const aiBatch = skipSingleHomeVibe
            ? mixedCandidatesForSkipAiBatch(rawLocations, 42, skipSingleHomeVibe)
            : rawLocations.slice(0, 30);

        // OpenAI Ranking
        let ranked = await rankLocationsWithAI({
            candidates: aiBatch,
            userTags: keywords,
            intenseMode: intenseMode
        });

        // Pool Backfilling
        let pool = ranked.filter(isRealPoi).slice(0, 20);
        if (pool.length < 15) {
            const used = new Set(pool.map(l => `${l.name}_${l.lat}_${l.lng}`));
            for (const loc of rawLocations) {
                if (pool.length >= 20) break;
                if (!isRealPoi(loc) || isNonTouristRoutePlace(loc)) continue;
                const k = `${loc.name}_${loc.lat}_${loc.lng}`;
                if (!used.has(k)) {
                    used.add(k);
                    pool.push(loc);
                }
            }
        }

        const skipFlowPlacePool = pool;
        const itineraryStops = skipFlowPlacePool.slice(0, visibleK);
        const standbyStops = skipFlowPlacePool.slice(visibleK);

        const dayRoutes = {
            0: itineraryStops.map((s, i) => ({
                index: i + 1,
                name: s.name,
                category: s.category,
                lat: s.lat,
                lng: s.lng,
                isAchieved: false,
                xpReward: generateDynamicXP(s.isSurprise ?? false)
            }))
        };

        const formattedRefreshQueue = standbyStops.slice(0, 20).map((s, i) => ({
            index: i + 1,
            name: s.name,
            category: s.category,
            lat: s.lat,
            lng: s.lng,
            isAchieved: false,
            xpReward: generateDynamicXP(s.isSurprise ?? false)
        }));

        // Save Trip
        const createTrip = await prisma.trip.create({
            data: {
                destination: "Skip Adventure",
                hotelLocation: "Current Location",
                tripDates: [new Date()],
                radiusKm: radiusKm,
                tripPace: intenseMode,
                travelWith: "Solo",
                interestedVibes: tags,
                flowKind: 'skip',
                user: {
                    connect: {
                        id: id
                    }
                }
            }
        });

        const { currentLatitude, currentLongitude, lastLocationUpdatedAt, ...tripData } = createTrip;

        return res.status(201).json({
            status: true,
            msg: "Trip planned successfully",
            trip: tripData,
            generatedRoutes: {
                dayRoutes,
                refreshQueue: formattedRefreshQueue
            }
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({
            status: false,
            msg: error.message
        });
    }
}

/**
 * @Description Save Journey    
 * @Route POST /trip/save-journey
 * @Access Private
 */
export const SaveJourney = async (req, res) => {
    const { id: userId } = req.user;
    const payload = req.body;

    const result = SaveJourneySchema(payload);
    if (result.error) {
        return res.status(400).json({ status: false, msg: result.error.details[0].message });
    }

    const { tripId, routeTitle, routesByDate } = payload;

    try {
        const trip = await prisma.trip.findFirst({
            where: { id: tripId, userId: userId }
        });

        if (!trip) {
            return res.status(404).json({ status: false, msg: "Trip not found" });
        }

        // Determine status based on dates
        let calculatedStatus = "upcoming";
        if (trip.tripDates && trip.tripDates.length > 0) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const startDate = new Date(trip.tripDates[0]);
            startDate.setHours(0, 0, 0, 0);

            if (startDate.getTime() <= today.getTime()) {
                calculatedStatus = "in-progress";
            }
        }

        const updateData = {
            routeTitle: routeTitle,
            status: calculatedStatus
        };

        console.log("PAYLOAD ROUTES BY DATE:", routesByDate);

        if (routesByDate !== undefined) {
            // Strip visible field from each stop before saving
            const sanitizedRoutes = {};
            for (const [day, stops] of Object.entries(routesByDate)) {
                sanitizedRoutes[day] = stops.map(({ visible, ...stop }) => stop);
            }
            updateData.routesByDate = sanitizedRoutes;
        }

        console.log("UPDATE DATA:", updateData);

        const updateTrip = await prisma.trip.update({
            where: { id: tripId },
            data: updateData
        });

        console.log("UPDATED TRIP ROUTES:", updateTrip.routesByDate);

        return res.status(200).json({
            status: true,
            msg: "Journey saved successfully",
            trip: updateTrip
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            status: false,
            msg: error.message
        });
    }
}

/**
 * @Description Get My Trips    
 * @Route GET /trip/get-my-trips
 * @Access Private
 */
export const GetMyTrips = async (req, res) => {
    const { id: userId } = req.user;
    const { status } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    try {

        const trips = await prisma.trip.findMany({
            where: { userId: userId, status: status },
            orderBy: { createdAt: 'desc' },
            skip: skip,
            take: limit
        });

        const total = await prisma.trip.count({
            where: { userId: userId, status: status }
        });

        const totalPages = Math.ceil(total / limit);
        const hasNextPage = page < totalPages;
        const nextPage = hasNextPage ? page + 1 : 0;

        return res.status(200).json({
            status: true,
            msg: "My trips fetched successfully",
            data: trips,
            pagination: {
                currentPage: page,
                limit,
                hasNextPage,
                nextPage
            }
        });
    } catch (error) {
        res.status(500).json({
            status: false,
            msg: error.message
        });
    }
}

/**
 * @Description Toggle the Navigation Status of a Trip (e.g. Start/Pause Journey)
 * @Route POST /trip/toggle-status
 * @Access Private
 */
export const StartAndPauseTrip = async (req, res) => {
    const { id: userId } = req.user;
    const payload = req.body;

    const result = StartAndPauseTripSchema(payload);
    if (result.error) {
        return res.status(400).json({
            status: false,
            msg: result.error.message
        });
    }

    try {
        const { tripId, navStatus } = payload;

        const trip = await prisma.trip.findFirst({
            where: { id: tripId, userId: userId }
        });

        if (!trip) {
            return res.status(404).json({ status: false, msg: "Trip not found" });
        }

        // Update the navStatus
        const updatedTrip = await prisma.trip.update({
            where: { id: tripId },
            data: {
                navStatus: navStatus
            }
        });

        return res.status(200).json({
            status: true,
            msg: `Trip navigation status updated to ${navStatus}`,
        });
    } catch (error) {
        res.status(500).json({
            status: false,
            msg: error.message
        });
    }
}

/**
 * @Description Trip Details
 * @Route POST /trip/trip-details/:id
 * @Access Private
 */
export const getTripDetails = async (req, res) => {
    const { id: userId } = req.user;
    const { tripId } = req.params;

    try {
        const trip = await prisma.trip.findFirst({
            where: { id: tripId, userId: userId }
        });

        if (!trip) {
            return res.status(404).json({ status: false, msg: "Trip not found" });
        }

        return res.status(200).json({
            status: true,
            msg: "Trip details fetched successfully",
            data: trip
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            status: false,
            msg: error.message
        });
    }
}

/**
 * @Description Get Merchant ads banner
 * @Route GET /trip/banner?city=&lat=&long=
 * @Access Private
 */
export const getMerchantAds = async (req, res) => {
    const { city, lat, long } = req.query;

    if (!city) {
        return res.status(400).json({
            status: false,
            msg: "City query parameter is required"
        });
    }

    try {
        const ads = await prisma.merchantAds.findMany({
            where: {
                city: { equals: city, mode: 'insensitive' },
                isActive: true,
                approvalStatus: 'approved'
            }
        });

        if (ads.length === 0) {
            return res.status(200).json({
                status: true,
                ads: []
            });
        }

        const userLat = lat !== undefined && lat !== "" ? parseFloat(lat) : null;
        const userLng = long !== undefined && long !== "" ? parseFloat(long) : null;

        // Filter ads by stock limit and coordinate/radius matching
        const eligibleAds = [];

        for (const ad of ads) {
            const hasStock = ad.stockLimit <= 0 || ad.rewardClaims < ad.stockLimit;
            if (!hasStock) continue;

            let dist = null;
            if (userLat !== null && !isNaN(userLat) && userLng !== null && !isNaN(userLng)) {
                dist = haversineDistance(userLat, userLng, ad.latitude, ad.longitude);
                if (ad.radius > 0 && dist > ad.radius) {
                    continue;
                }
            }

            eligibleAds.push({ ad, dist });
        }

        if (eligibleAds.length === 0) {
            return res.status(200).json({
                status: true,
                ads: []
            });
        }

        // If coordinates are provided, sort by nearest distance
        if (userLat !== null && !isNaN(userLat) && userLng !== null && !isNaN(userLng)) {
            eligibleAds.sort((a, b) => a.dist - b.dist);
        }

        const { id: userId } = req.user;

        // Fetch user claims for all eligible ads to determine if claimed
        const adIds = eligibleAds.map(item => item.ad.id);
        const userClaims = await prisma.merchantAdClaim.findMany({
            where: {
                userId: userId,
                adId: { in: adIds }
            }
        });
        const claimedAdIds = new Set(userClaims.map(c => c.adId));

        const results = eligibleAds.map(item => {
            const { approvalStatus, boxOpens, merchantId, merchantName, rewardClaims, impressions, ...adData } = item.ad;
            return {
                ad: adData,
                distanceM: item.dist !== null ? Math.round(item.dist) : null,
                isClaimed: claimedAdIds.has(item.ad.id)
            };
        });

        return res.status(200).json({
            status: true,
            ads: results
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status: false,
            msg: error.message
        });
    }
};

/**
 * @Description Record Merchant Ad Impression
 * @Route POST /trip/banner/:adId/impression
 * @Access Private
 */
export const recordAdImpression = async (req, res) => {
    const { id: userId } = req.user;
    const { adId } = req.params;

    try {
        const ad = await prisma.merchantAds.findUnique({
            where: { id: adId }
        });

        if (!ad) {
            return res.status(404).json({
                status: false,
                msg: "Campaign not found"
            });
        }

        // Increment total ad impressions and create user impression log in a transaction
        await prisma.$transaction([
            prisma.merchantAds.update({
                where: { id: adId },
                data: { impressions: { increment: 1 } }
            }),
            prisma.adImpression.create({
                data: {
                    adId: adId,
                    userId: userId
                }
            })
        ]);

        return res.status(200).json({
            status: true,
            msg: "Impression recorded successfully"
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status: false,
            msg: error.message
        });
    }
};

/**
 * @Description Claim Reward
 * @Route POST /trip/banner/
 * @Access Private
 */
export const claimReward = async (req, res) => {
    const { id: userId } = req.user;
    const adId = req.params.adId;
    console.log("adId : ", adId)
    if (!adId) {
        return res.status(400).json({
            status: false,
            msg: "Ad ID is required"
        });
    }

    try {
        // 1. Check if the ad exists
        const ad = await prisma.merchantAds.findUnique({
            where: { id: adId }
        });

        if (!ad) {
            return res.status(404).json({
                status: false,
                msg: "Campaign not found"
            });
        }

        // 2. If user has already claimed the ad, return alreadyClaimed
        const existingClaim = await prisma.merchantAdClaim.findUnique({
            where: {
                userId_adId: {
                    userId,
                    adId
                }
            }
        });

        if (existingClaim) {
            return res.status(200).json({
                status: false,
                msg: "alreadyClaimed"
            });
        }

        // 3. Check if rewardClaims < stockLimit (unless stockLimit <= 0)
        const isSoldOut = ad.stockLimit > 0 && ad.rewardClaims >= ad.stockLimit;
        if (isSoldOut) {
            return res.status(200).json({
                status: false,
                msg: "soldOut"
            });
        }

        let assignedCode = null;

        try {
            await prisma.$transaction(async (tx) => {
                // Find an available code if stock limit > 0
                if (ad.stockLimit > 0) {
                    const availableCode = await tx.merchantAdCode.findFirst({
                        where: { adId: ad.id, isClaimed: false }
                    });

                    if (!availableCode) {
                        throw new Error("soldOut");
                    }

                    assignedCode = availableCode.code;

                    const claimDoc = await tx.merchantAdClaim.create({
                        data: { adId, userId }
                    });

                    await tx.merchantAdCode.update({
                        where: { id: availableCode.id },
                        data: {
                            isClaimed: true,
                            claimId: claimDoc.id
                        }
                    });
                } else {
                    // Generate a dynamic code for unlimited stock
                    assignedCode = crypto.randomBytes(4).toString('hex').toUpperCase();

                    const claimDoc = await tx.merchantAdClaim.create({
                        data: { adId, userId }
                    });

                    await tx.merchantAdCode.create({
                        data: {
                            adId,
                            code: assignedCode,
                            isClaimed: true,
                            claimId: claimDoc.id
                        }
                    });
                }

                const nextClaimsCount = ad.rewardClaims + 1;
                const reachedStockLimit = ad.stockLimit > 0 && nextClaimsCount >= ad.stockLimit;

                await tx.merchantAds.update({
                    where: { id: adId },
                    data: {
                        rewardClaims: { increment: 1 },
                        isActive: reachedStockLimit ? false : undefined
                    }
                });

                await tx.user.update({
                    where: { id: userId },
                    data: { rewards_claimed: { increment: 1 } }
                });
            });
        } catch (txError) {
            if (txError.message === "soldOut") {
                return res.status(200).json({
                    status: false,
                    msg: "soldOut"
                });
            }
            throw txError;
        }

        return res.status(200).json({
            status: true,
            msg: "success",
            code: assignedCode
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status: false,
            msg: error.message
        });
    }
};

/**
 * @Description Claim Live Event Reward
 * @Route POST /trip/live-event/claim/:eventId
 * @Access Private
 */
export const claimLiveEventReward = async (req, res) => {
    const { id: userId } = req.user;
    const eventId = req.params.eventId;
    const { userLat, userLng } = req.body;

    if (!eventId) {
        return res.status(400).json({
            status: false,
            msg: "Event ID is required"
        });
    }

    if (userLat === undefined || userLng === undefined) {
        return res.status(400).json({
            status: false,
            msg: "User coordinates (userLat, userLng) are required"
        });
    }

    try {
        // 1. Fetch the Live Event
        const event = await prisma.liveEvent.findUnique({
            where: { id: eventId }
        });

        if (!event) {
            return res.status(404).json({
                status: false,
                msg: "Live Event not found"
            });
        }

        // 2. Validate Event is Live
        if (event.status !== "live") {
            return res.status(400).json({
                status: false,
                msg: `Cannot claim reward. Event is currently "${event.status}" (must be "live").`
            });
        }

        // 3. Validate Radius (Must be within 20 meters)
        const distance = haversineDistance(
            parseFloat(userLat),
            parseFloat(userLng),
            event.latitude,
            event.longitude
        );

        if (distance > 20) {
            return res.status(400).json({
                status: false,
                msg: `Too far from event location. You are ${Math.round(distance)}m away, but you must be within 20 meters to claim.`
            });
        }

        // 4. Check if User has already claimed this event's reward
        const existingClaim = await prisma.liveEventClaim.findUnique({
            where: {
                eventId_userId: {
                    eventId,
                    userId
                }
            }
        });

        if (existingClaim) {
            return res.status(400).json({
                status: false,
                msg: "alreadyClaimed"
            });
        }

        // 5. Validate Reward Stock Availability
        if (event.remainingQty <= 0) {
            return res.status(400).json({
                status: false,
                msg: "soldOut"
            });
        }

        // 6. Generate a dynamic coupon/voucher code
        const assignedCode = crypto.randomBytes(4).toString('hex').toUpperCase();

        // 7. Perform Claim in Transaction
        const xpAwarded = event.xpReward || 0;

        const [claimDoc] = await prisma.$transaction([
            prisma.liveEventClaim.create({
                data: {
                    eventId,
                    userId,
                    code: assignedCode,
                    xpEarned: xpAwarded,
                    lat: parseFloat(userLat),
                    lng: parseFloat(userLng)
                }
            }),
            prisma.liveEvent.update({
                where: { id: eventId },
                data: {
                    remainingQty: { decrement: 1 }
                }
            }),
            prisma.user.update({
                where: { id: userId },
                data: {
                    xp_earned: { increment: xpAwarded },
                    rewards_claimed: { increment: 1 }
                }
            })
        ]);

        return res.status(200).json({
            status: true,
            msg: "success",
            code: assignedCode,
            xpEarned: xpAwarded
        });

    } catch (error) {
        console.error("Claim Live Event Reward Error:", error);
        return res.status(500).json({
            status: false,
            msg: error.message || "Internal server error"
        });
    }
};

/**
 * @Description Surprise me 
 * @Route GET /trip/surprise-me?city=&lat=&long=&vibeTitle=
 * @Access Private
 */
export const surpriseMe = async (req, res) => {
    const { city, lat, long, vibeTitle } = req.query;

    if (!city) {
        return res.status(400).json({
            status: false,
            msg: "City query parameter is required"
        });
    }

    if (lat === undefined || long === undefined || lat === "" || long === "") {
        return res.status(400).json({
            status: false,
            msg: "lat and long query parameters are required for range checks"
        });
    }

    const userLat = parseFloat(lat);
    const userLng = parseFloat(long);

    if (isNaN(userLat) || isNaN(userLng)) {
        return res.status(400).json({
            status: false,
            msg: "Invalid latitude or longitude coordinates"
        });
    }

    try {
        // 1. Fetch ads in the city
        const ads = await prisma.merchantAds.findMany({
            where: {
                city: { equals: city, mode: 'insensitive' },
                isActive: true,
                approvalStatus: 'approved'
            }
        });

        let eligibleAds = [];

        if (ads.length > 0) {
            // 2. Fetch user claims and impressions for these ads to filter them out
            const { id: userId } = req.user;
            const adIds = ads.map(ad => ad.id);
            const userClaims = await prisma.merchantAdClaim.findMany({
                where: {
                    userId: userId,
                    adId: { in: adIds }
                }
            });
            const claimedAdIds = new Set(userClaims.map(c => c.adId));

            const userImpressions = await prisma.adImpression.findMany({
                where: {
                    userId: userId,
                    adId: { in: adIds }
                }
            });
            const seenAdIds = new Set(userImpressions.map(i => i.adId));

            // 3. Filter ads by claim status, seen status, stock limit, and 2km range limit
            for (const ad of ads) {
                // Filter out claimed or seen ads
                if (claimedAdIds.has(ad.id) || seenAdIds.has(ad.id)) continue;

                // Check stock limit
                const hasStock = ad.stockLimit <= 0 || ad.rewardClaims < ad.stockLimit;
                if (!hasStock) continue;

                const dist = haversineDistance(userLat, userLng, ad.latitude, ad.longitude);

                // Enforce 2km (2000m) range limit
                if (dist > 2000) {
                    continue;
                }

                eligibleAds.push({ ad, dist });
            }
        }

        let selectedAd = null;
        let distanceM = null;
        let isFallback = false;

        if (eligibleAds.length > 0) {
            // 4. Shuffle eligible ads to give a different ad on each API call instead of sorting by distance
            eligibleAds.sort(() => 0.5 - Math.random());
            const { approvalStatus, boxOpens, merchantId, merchantName, rewardClaims, impressions, ...adData } = eligibleAds[0].ad;
            selectedAd = adData;
            distanceM = Math.round(eligibleAds[0].dist);
        } else {
            const searchKeyword = vibeTitle ? vibeTitle.split('||').map(v => v.trim()).join(' ') : undefined;

            const candidates = await fetchSurpriseNearbyCandidates(userLat, userLng, searchKeyword, searchKeyword);
            if (candidates && candidates.length > 0) {
                // Shuffle candidates to give a different Google place on each API call
                candidates.sort(() => 0.5 - Math.random());
                const best = candidates[0];
                selectedAd = {
                    id: best.place_id,
                    title: best.name,
                    category: best.category,
                    latitude: best.lat,
                    longitude: best.lng,
                    city: city
                };
                distanceM = Math.round(best.dist);
                isFallback = true;
            }
        }

        if (selectedAd && !isFallback) {
            try {
                const { id: userId } = req.user;
                await prisma.adImpression.create({
                    data: {
                        userId: userId,
                        adId: selectedAd.id
                    }
                });
            } catch (err) {
                console.error("Failed to auto-record impression for surprise ad:", err);
            }
        }

        return res.status(200).json({
            status: true,
            ad: selectedAd,
            distanceM,
            isClaimed: false,
            isFallback,
            xpReward: generateDynamicXP(true)
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status: false,
            msg: error.message
        });
    }
};
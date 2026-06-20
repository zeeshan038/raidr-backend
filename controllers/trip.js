//Schema 
import { PlanYourTripSchema, SkipTripSchema, StartAndPauseTripSchema, SaveJourneySchema } from "../schema/Trip.js"

// Prisma
import { prisma } from "../config/db.js"

//Service
import { searchRouteBreakpoints } from "../services/googlePlaces.js"

//Utils
import { rankPlanCandidatesChunked, rankLocationsWithAI, generateCityVibeSuggestions, generateLoadingTexts } from "../utils/Openai.js"
import {
    expandTags,
    fairInterleavedSearchKeywords,
    buildPlanFlowMasterPool,
    partitionPlanFlowPoolIntoDays,
    isRealPoi,
    mixedCandidatesForSkipAiBatch,
    randomDestination,
    isNonTouristRoutePlace,
    buildRouteItems
} from "../utils/tripUtils.js"


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
        const startLat = payload.startLat || 25.20;
        const startLng = payload.startLng || 55.27;
        const intenseMode = payload.intenseMode || false;
        const totalDays = payload.tripDates?.length || 1;
        const visibleK = intenseMode ? 6 : 3;

        // Extract vibe strings
        const likedTitles = payload.interestedVibes || [];
        const keywordTags = expandTags(likedTitles);
        const searchKeywords = fairInterleavedSearchKeywords(likedTitles);

        // Handle travelWith array (e.g., ["Family"])
        const familyPartyPlan = payload.travelWith && payload.travelWith.includes("Family");

        // Google Places Search
        let rawLocations = await searchRouteBreakpoints({
            startLat,
            startLng,
            radiusKm: payload.radiusKm || 10,
            keywords: searchKeywords,
            targetPoolSize: 50,
            minCandidatesOverride: familyPartyPlan ? 128 : 80,
            ensureAllKeywordsSearchedAtFirstRadius: true
        });

        // Limit candidates to send to AI
        rawLocations = rawLocations.slice(0, 130);

        // OpenAI Ranking
        const rankedCandidates = await rankPlanCandidatesChunked(rawLocations, keywordTags, likedTitles.length > 1, intenseMode);

        // Build Master Pool
        const masterPool = buildPlanFlowMasterPool(rankedCandidates, likedTitles, visibleK);

        // Partition into Days
        const { planDayTaggedStops, planFlowRefreshQueue } = partitionPlanFlowPoolIntoDays(masterPool, totalDays, visibleK);

        // Map routes
        const dayRoutes = {};
        for (let d = 0; d < totalDays; d++) {
            dayRoutes[d] = planDayTaggedStops[d] || [];
        }

        const createTrip = await prisma.trip.create({
            data: {
                destination: payload.destination,
                hotelLocation: payload.hotelLocation,
                tripDates: payload.tripDates,
                radiusKm: payload.radiusKm,
                tripPace: intenseMode,
                travelWith: Array.isArray(payload.travelWith) ? payload.travelWith[0] : payload.travelWith,
                interestedVibes: payload.interestedVibes,
                imageUrls: payload.imageUrls,
                user: {
                    connect: {
                        id: id
                    }
                }
            }
        })

        return res.status(201).json({
            status: true,
            msg: "Trip planned successfully",
            trip: createTrip,
            generatedRoutes: {
                dayRoutes,
                refreshQueue: planFlowRefreshQueue
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
 * @Route POST /trip/city-weather
 * @Access Private
 */
export const GetCityWeather = async (req, res) => {
    const { lat, lng } = req.body;

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
        const placesUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent("popular tourist attractions in " + query)}&key=${placesApiKey}`;

        const placesRes = await fetch(placesUrl);
        const placesData = await placesRes.json();

        if (placesData.results && placesData.results.length > 0) {
            // Collect photos from the results
            const photos = [];
            placesData.results.forEach(place => {
                if (place.photos) {
                    photos.push(...place.photos);
                }
            });

            // Get up to 5 beautiful images
            imageUrls = photos.slice(0, 5).map(photo => {
                return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${photo.photo_reference}&key=${placesApiKey}`;
            });
        }

        // Run OpenAI tasks in parallel without waiting for images first
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
        const routeItems = buildRouteItems(itineraryStops);

        const generatedStartPoint = { lat: startLat, lng: startLng };
        const generatedDestinationPoint = itineraryStops.length
            ? { lat: itineraryStops[itineraryStops.length - 1].lat, lng: itineraryStops[itineraryStops.length - 1].lng }
            : randomDestination(startLat, startLng, 1);

        // Map routes (Skip flow is always 1 day -> day 0)
        const dayRoutes = { 0: routeItems };

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
                imageUrls: [],
                user: {
                    connect: {
                        id: id
                    }
                }
            }
        });

        return res.status(201).json({
            status: true,
            msg: "Skip Trip generated successfully",
            trip: createTrip,
            skipFlowPlacePool,
            itineraryStops,
            generatedStartPoint,
            generatedDestinationPoint,
            dayRoutes
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
            updateData.routesByDate = routesByDate;
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
    const {status} = req.query;
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
       
        return res.status(200).json({
            status: true,
            msg: "My trips fetched successfully",
            data: trips,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
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
    console.log("id",userId)
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
            trip: updatedTrip
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            status: false,
            msg: error.message
        });
    }
}
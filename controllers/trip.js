//Schema 
import { PlanYourTripSchema } from "../schema/Trip.js"

// Prisma
import { prisma } from "../config/db.js"

//Service
import { searchRouteBreakpoints } from "../services/googlePlaces.js"

//Utils
import { rankPlanCandidatesChunked } from "../utils/Openai.js"
import {
    expandTags,
    fairInterleavedSearchKeywords,
    buildPlanFlowMasterPool,
    partitionPlanFlowPoolIntoDays
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

        // 1. Google Places Search
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

        // 2. OpenAI Ranking
        const rankedCandidates = await rankPlanCandidatesChunked(rawLocations, keywordTags, likedTitles.length > 1, intenseMode);

        // 3. Build Master Pool
        const masterPool = buildPlanFlowMasterPool(rankedCandidates, likedTitles, visibleK);

        // 4. Partition into Days
        const { planDayTaggedStops, planFlowRefreshQueue } = partitionPlanFlowPoolIntoDays(masterPool, totalDays, visibleK);

        // Map routes
        const dayRoutes = {};
        for (let d = 0; d < totalDays; d++) {
            dayRoutes[d] = planDayTaggedStops[d] || [];
        }

        const createTrip = await prisma.trip.create({
            data: {
                id,
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
    const { city } = req.body;

    if (!city) {
        return res.status(400).json({ status: false, msg: "City name is required" });
    }

    try {
        // Fetch weather from OpenWeatherMap
        const weatherApiKey = process.env.OPENWEATHER_API_KEY;
        const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${weatherApiKey}&units=metric`;

        const weatherRes = await fetch(weatherUrl);
        const weatherData = await weatherRes.json();

        if (!weatherRes.ok) {
            return res.status(400).json({ status: false, msg: weatherData.message || "Failed to fetch weather" });
        }

        const placesApiKey = process.env.GOOGLE_PLACES_API_KEY;
        let imageUrls = [];

        const query = city || weatherData.name;
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

        return res.status(200).json({
            status: true,
            msg: "Weather and images fetched successfully",
            weather: weatherData,
            images: imageUrls
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status: false,
            msg: error.message
        });
    }
}
import { prisma } from "../../config/db.js";
import { MerchantEventCreateSchema } from "../../schema/Merchant/Event.js";
import { haversineDistance } from "../../utils/methods/methods.js";

const EVENT_COSTS = {
    small: 10,
    medium: 25,
    large: 50
};

/**
 * @description Create new Live Event
 * @Route POST /api/merchant/events/create
 * @Access Private (Merchant)
 */
export const createLiveEvent = async (req, res) => {
    const { id: merchantId } = req.merchant;
    const payload = req.body;

    const result = MerchantEventCreateSchema(payload);
    if (result.error) {
        return res.status(400).json({
            status: false,
            msg: result.error.message
        });
    }

    const {
        title,
        description,
        address,
        latitude,
        longitude,
        startTime,
        endTime,
        reward,
        rewardQuantity,
        size,
        commanderAvatar,
        imageUrl
    } = payload;

    const parsedStart = new Date(startTime);
    const parsedEnd = new Date(endTime);

    if (parsedEnd <= parsedStart) {
        return res.status(400).json({
            status: false,
            msg: "End time must be after the start time"
        });
    }

    // Minimum event duration: 30 minutes
    const durationMs = parsedEnd - parsedStart;
    if (durationMs < 30 * 60 * 1000) {
        return res.status(400).json({
            status: false,
            msg: "Event duration must be at least 30 minutes"
        });
    }

    const cost = EVENT_COSTS[size];

    try {
        // 1. Fetch merchant to verify credits
        const merchant = await prisma.merchant.findUnique({
            where: { id: merchantId }
        });

        if (!merchant) {
            return res.status(404).json({
                status: false,
                msg: "Merchant not found"
            });
        }

        if (merchant.credits < cost) {
            return res.status(400).json({
                status: false,
                msg: `Insufficient credits. Creating a ${size} event requires ${cost} credits, but you only have ${merchant.credits}.`
            });
        }

        // 2. Radius Protection Check
        // Query scheduled or live events that overlap in time
        const overlappingEvents = await prisma.liveEvent.findMany({
            where: {
                status: { in: ["scheduled", "live"] },
                startTime: { lt: parsedEnd },
                endTime: { gt: parsedStart }
            }
        });

        for (const event of overlappingEvents) {
            const distance = haversineDistance(latitude, longitude, event.latitude, event.longitude);
            if (distance <= 500) {
                return res.status(400).json({
                    status: false,
                    msg: "Radius Conflict: Another event exists within 500 meters during this time window."
                });
            }
        }

        // Determine status: small event is auto-scheduled, medium/large need approval
        const status = size === 'small' ? 'scheduled' : 'pending_approval';

        // 3. Perform database operations in transaction
        const [updatedMerchant, newEvent] = await prisma.$transaction([
            prisma.merchant.update({
                where: { id: merchantId },
                data: {
                    credits: { decrement: cost }
                }
            }),
            prisma.liveEvent.create({
                data: {
                    title,
                    description,
                    address: address || "",
                    merchantId,
                    commanderAvatar: commanderAvatar || merchant.photoUrl || "",
                    imageUrl: imageUrl || "",
                    latitude: parseFloat(latitude),
                    longitude: parseFloat(longitude),
                    startTime: parsedStart,
                    endTime: parsedEnd,
                    reward,
                    rewardQuantity: parseInt(rewardQuantity),
                    remainingQty: parseInt(rewardQuantity),
                    status,
                    size,
                    xpReward: Math.floor(Math.random() * 201) + 100  // Random XP between 100–300
                }
            })
        ]);

        // Create log entry
        await prisma.merchantCreditLog.create({
            data: {
                merchantId,
                amount: -cost,
                type: "event_creation",
                description: `Created ${size} event "${title}" (${cost} credits deducted)`,
                eventId: newEvent.id
            }
        });

        return res.status(201).json({
            status: true,
            msg: size === 'small' 
                ? "Event created and scheduled successfully" 
                : "Event submitted successfully and is pending admin approval",
            event: newEvent
        });

    } catch (error) {
        console.error("Create Live Event Error:", error);
        return res.status(500).json({
            status: false,
            msg: error.message || "Internal server error"
        });
    }
};

/**
 * @description Get my created Live Events
 * @Route GET /api/merchant/events/my-events
 * @Access Private (Merchant)
 */
export const getMyEvents = async (req, res) => {
    const { id: merchantId } = req.merchant;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    try {
        const [events, totalCount] = await Promise.all([
            prisma.liveEvent.findMany({
                where: { merchantId },
                skip,
                take: limit,
                orderBy: { createdAt: "desc" }
            }),
            prisma.liveEvent.count({
                where: { merchantId }
            })
        ]);

        return res.status(200).json({
            status: true,
            msg: "Events fetched successfully",
            events,
            pagination: {
                page,
                limit,
                totalPages: Math.ceil(totalCount / limit),
                totalCount
            }
        });
    } catch (error) {
        console.error("Get My Events Error:", error);
        return res.status(500).json({
            status: false,
            msg: error.message || "Internal server error"
        });
    }
};
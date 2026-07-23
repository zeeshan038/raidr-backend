import crypto from 'crypto';
import { prisma } from "../../config/db.js";
import {
    MerchantEventCreateSchema,
    MerchantEventUpdateSchema
} from "../../schema/Merchant/Event.js";
import {
    haversineDistance,
    calculateRadiusForUserLiveEvent
} from "../../utils/methods/methods.js";
import { sendNotification } from "../../utils/Notification.js";

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

        const qrCodeToken = `event-qr-${crypto.randomBytes(16).toString('hex')}`;

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
                    qrCode: qrCodeToken,
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

        // Notify users within 20km radius
        try {
            const usersWithTokens = await prisma.user.findMany({
                where: {
                    fcmToken: { not: null }
                },
                select: { id: true, lat: true, long: true, fcmToken: true }
            });

            const nearbyUsers = calculateRadiusForUserLiveEvent(usersWithTokens, newEvent.latitude, newEvent.longitude, 20);

            for (const user of nearbyUsers) {
                sendNotification(user.fcmToken, "⚡ A New Raid Has Appeared!", `"${title}" is now live near you. Be among the first to join and claim exclusive rewards!`)
                    .catch(err => console.error(`Failed to send notification to user ${user.id}:`, err));
            }
        } catch (notifErr) {
            console.error("Error sending notifications on event creation:", notifErr);
        }

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


/**
 * @description Update An Event
 * @Route PUT /api/merchant/events/update-event/:eventId
 * @Access Private (Merchant)
 */
export const updateLiveEvent = async (req, res) => {
    const { id: merchantId } = req.merchant;
    const { eventId } = req.params;
    const payload = req.body;

    const result = MerchantEventUpdateSchema(payload);
    if (result.error) {
        return res.status(400).json({
            status: false,
            msg: result.error.message
        });
    }

    try {
        const existingEvent = await prisma.liveEvent.findUnique({
            where: { id: eventId }
        });

        if (!existingEvent) {
            return res.status(404).json({
                status: false,
                msg: "Event not found"
            });
        }

        if (existingEvent.merchantId !== merchantId) {
            return res.status(403).json({
                status: false,
                msg: "Unauthorized to update this event"
            });
        }

        if (existingEvent.status === "completed" || existingEvent.status === "cancelled") {
            return res.status(400).json({
                status: false,
                msg: "Cannot update completed or cancelled events"
            });
        }

        const updateData = { ...payload };

        const startTime = payload.startTime ? new Date(payload.startTime) : existingEvent.startTime;
        const endTime = payload.endTime ? new Date(payload.endTime) : existingEvent.endTime;

        if (payload.startTime || payload.endTime) {
            if (endTime <= startTime) {
                return res.status(400).json({
                    status: false,
                    msg: "End time must be after the start time"
                });
            }
            const durationMs = endTime - startTime;
            if (durationMs < 30 * 60 * 1000) {
                return res.status(400).json({
                    status: false,
                    msg: "Event duration must be at least 30 minutes"
                });
            }
            updateData.startTime = startTime;
            updateData.endTime = endTime;
        }

        if (payload.latitude || payload.longitude || payload.startTime || payload.endTime) {
            const lat = payload.latitude ? parseFloat(payload.latitude) : existingEvent.latitude;
            const lng = payload.longitude ? parseFloat(payload.longitude) : existingEvent.longitude;

            const overlappingEvents = await prisma.liveEvent.findMany({
                where: {
                    id: { not: eventId },
                    status: { in: ["scheduled", "live"] },
                    startTime: { lt: endTime },
                    endTime: { gt: startTime }
                }
            });

            for (const event of overlappingEvents) {
                const distance = haversineDistance(lat, lng, event.latitude, event.longitude);
                if (distance <= 500) {
                    return res.status(400).json({
                        status: false,
                        msg: "Radius Conflict: Another event exists within 500 meters during this time window."
                    });
                }
            }

            if (payload.latitude) updateData.latitude = parseFloat(payload.latitude);
            if (payload.longitude) updateData.longitude = parseFloat(payload.longitude);
        }

        if (payload.rewardQuantity) {
            const diff = parseInt(payload.rewardQuantity) - existingEvent.rewardQuantity;
            updateData.remainingQty = existingEvent.remainingQty + diff;
            updateData.rewardQuantity = parseInt(payload.rewardQuantity);

            if (updateData.remainingQty < 0) {
                return res.status(400).json({
                    status: false,
                    msg: "New reward quantity is less than what has already been claimed."
                });
            }
        }

        const updatedEvent = await prisma.liveEvent.update({
            where: { id: eventId },
            data: updateData
        });

        return res.status(200).json({
            status: true,
            msg: "Event updated successfully",
            event: updatedEvent
        });

    } catch (error) {
        console.error("Update Live Event Error:", error);
        return res.status(500).json({
            status: false,
            msg: error.message || "Internal server error"
        });
    }
};

/**
 * @description Get Live Event By ID
 * @Route GET /api/merchant/events/specific-event/:eventId
 * @Access Private (Merchant)
 */
export const getEventById = async (req, res) => {
    const { id: merchantId } = req.merchant;
    const { eventId } = req.params;

    try {
        const event = await prisma.liveEvent.findUnique({
            where: { id: eventId },
            include: {
                merchant: {
                    select: {
                        photoUrl: true
                    }
                },
                claims: {
                    include: {
                        user: {
                            select: {
                                name: true,
                                email: true,
                                photoUrl: true
                            }
                        }
                    },
                    orderBy: {
                        claimedAt: 'desc'
                    }
                }
            }
        });

        if (!event) {
            return res.status(404).json({
                status: false,
                msg: "Event not found"
            });
        }

        if (event.merchantId !== merchantId) {
            return res.status(403).json({
                status: false,
                msg: "Unauthorized to view this event"
            });
        }

        return res.status(200).json({
            status: true,
            msg: "Event fetched successfully",
            event
        });

    } catch (error) {
        console.error("Get Event By ID Error:", error);
        return res.status(500).json({
            status: false,
            msg: error.message || "Internal server error"
        });
    }
};

/**
 * @description Delete Event
 * @Route GET /api/merchant/events/delete/:eventId
 * @Access Private (Merchant)
 */
export const deleteEvent = async (req, res) => {
    const { id: merchantId } = req.merchant;
    const { eventId } = req.params;

    try {
        const event = await prisma.liveEvent.findUnique({
            where: { id: eventId }
        });

        if (!event) {
            return res.status(404).json({
                status: false,
                msg: "Event not found"
            });
        }

        if (event.merchantId !== merchantId) {
            return res.status(403).json({
                status: false,
                msg: "Unauthorized to delete this event"
            });
        }

        await prisma.liveEvent.delete({
            where: { id: eventId }
        });

        return res.status(200).json({
            status: true,
            msg: "Event deleted successfully"
        });
    } catch (error) {
        return res.status(500).json({
            status: false,
            msg: error.message
        });
    }
};

/**
 * @Description Redeem an event coupon code
 * @Route POST /api/merchant/events/redeem-coupon
 * @Access Private (Merchant)
 */
export const redeemEventCoupon = async (req, res) => {
    const { id: merchantId } = req.merchant;
    const { couponCode } = req.body;

    if (!couponCode) {
        return res.status(400).json({ status: false, msg: "Coupon code is required" });
    }

    try {
        const claim = await prisma.liveEventClaim.findFirst({
            where: { code: couponCode },
            include: { event: true }
        });

        if (!claim) {
            return res.status(404).json({ status: false, msg: "Invalid coupon code" });
        }

        if (claim.event.merchantId !== merchantId) {
            return res.status(403).json({ status: false, msg: "Unauthorized to redeem this coupon" });
        }

        if (claim.isRedeemed) {
            return res.status(400).json({ status: false, msg: "This coupon has already been redeemed" });
        }

        const updatedClaim = await prisma.liveEventClaim.update({
            where: { id: claim.id },
            data: { 
                isRedeemed: true,
                redeemedAt: new Date()
            }
        });

        return res.status(200).json({
            status: true,
            msg: "Coupon successfully redeemed!",
            data: updatedClaim
        });

    } catch (err) {
        return res.status(500).json({ status: false, msg: err.message });
    }
};

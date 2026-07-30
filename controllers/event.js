import crypto from 'crypto';

import { prisma } from "../config/db.js";
import {
    publishParticipantJoined,
    publishInventoryUpdated,
    publishCommanderMessage,
    publishToUser
} from "../sockets/eventPublisher.js";
import { generateDynamicXP, haversineDistance, isSameCountryOrClose } from "../utils/methods/methods.js";

/**
 * @Description Get events (live, scheduled, ended)
 * @Route GET /api/user/events/discovery?page=1&limit=10&status=live
 * @Access Private (User)
 */
export const GetEvents = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const { status } = req.query;
    const { id: userId } = req.user;

    let statusFilter;
    if (status === "live") {
        statusFilter = "live";
    } else if (status === "scheduled") {
        statusFilter = "scheduled";
    } else if (status === "ended") {
        statusFilter = { in: ["completed", "cancelled"] };
    } else {
        statusFilter = { in: ["live", "scheduled"] };
    }

    try {
        const [liveEvents, coinRushEvents] = await Promise.all([
            prisma.liveEvent.findMany({
                where: {
                    status: statusFilter
                },
                include: {
                    participants: {
                        where: {
                            userId: userId
                        }
                    }
                }
            }),
            prisma.coinRushEvent.findMany({
                where: {
                    status: statusFilter
                },
                include: {
                    participants: {
                        where: {
                            userId: userId
                        }
                    }
                }
            })
        ]);

        const formattedLiveEvents = liveEvents.map(event => {
            const isJoined = event.participants.length > 0;
            const { participants, ...eventData } = event;
            return {
                ...eventData,
                isJoined,
                isCoinRush: false
            };
        });

        const formattedCoinRushEvents = coinRushEvents.map(event => {
            const isJoined = event.participants.length > 0;
            const { participants, ...eventData } = event;
            return {
                ...eventData,
                isJoined,
                isCoinRush: true
            };
        });

        const mergedEvents = [...formattedLiveEvents, ...formattedCoinRushEvents];

        const userLat = req.user.lat ? parseFloat(req.user.lat) : null;
        const userLng = req.user.long ? parseFloat(req.user.long) : null;

        let filteredEvents = mergedEvents;

        if (userLat !== null && !isNaN(userLat) && userLng !== null && !isNaN(userLng)) {
            // Filter by same country or proximity
            filteredEvents = mergedEvents.filter(event => {
                const eventLat = event.isCoinRush ? event.centerLat : event.latitude;
                const eventLng = event.isCoinRush ? event.centerLng : event.longitude;
                if (eventLat === null || eventLng === null || eventLat === undefined || eventLng === undefined) {
                    return true;
                }
                return isSameCountryOrClose(userLat, userLng, eventLat, eventLng);
            });

            // Calculate distance and sort nearest to farthest
            filteredEvents = filteredEvents.map(event => {
                const eventLat = event.isCoinRush ? event.centerLat : event.latitude;
                const eventLng = event.isCoinRush ? event.centerLng : event.longitude;
                const distance = (eventLat !== null && eventLng !== null && eventLat !== undefined && eventLng !== undefined)
                    ? haversineDistance(userLat, userLng, eventLat, eventLng)
                    : Infinity;
                return {
                    ...event,
                    distance // in meters
                };
            });

            filteredEvents.sort((a, b) => a.distance - b.distance);
        } else {
            // Fallback: sort by startTime
            filteredEvents.sort((a, b) => {
                const timeA = a.startTime ? new Date(a.startTime).getTime() : 0;
                const timeB = b.startTime ? new Date(b.startTime).getTime() : 0;
                return timeA - timeB;
            });
        }

        const totalEvents = filteredEvents.length;
        const paginatedEvents = filteredEvents.slice(skip, skip + limit);
        const totalPages = Math.ceil(totalEvents / limit);

        return res.status(200).json({
            status: true,
            msg: "Events fetched successfully",
            events: paginatedEvents,
            pagination: {
                page,
                limit,
                totalPages,
                hasNextPage: page < totalPages
            }
        });
    } catch (error) {
        return res.status(500).json({
            status: false,
            msg: error.message
        });
    }
};

/**
 * @Description Get Event Details
 * @Route GET /api/user/events/event-details/:eventId
 * @Access Private (User)
 */
export const eventDetails = async (req, res) => {
    const { eventId } = req.params;
    const { id: userId } = req.user;

    if (!eventId) {
        return res.status(400).json({
            status: false,
            msg: "Event ID is required"
        });
    }

    try {
        // Fetch event data and claims in parallel (1 database round-trip)
        const [liveEvent, coinRushEvent, liveClaim, coinRushClaim] = await Promise.all([
            prisma.liveEvent.findUnique({
                where: { id: eventId },
                include: {
                    participants: {
                        where: { userId }
                    },
                    _count: {
                        select: { participants: true }
                    }
                }
            }),
            prisma.coinRushEvent.findUnique({
                where: { id: eventId },
                include: {
                    checkpoints: {
                        orderBy: { sequence: 'asc' }
                    },
                    participants: {
                        where: { userId }
                    },
                    progress: {
                        where: { userId }
                    },
                    _count: {
                        select: { participants: true }
                    }
                }
            }),
            prisma.liveEventClaim.findUnique({
                where: {
                    eventId_userId: { eventId, userId }
                }
            }),
            prisma.coinRushClaim.findUnique({
                where: {
                    eventId_userId: { eventId, userId }
                }
            })
        ]);

        if (liveEvent) {
            const liveParticipant = liveEvent.participants[0];
            const agreedToSafetyWarning = liveParticipant ? (liveParticipant.agreedToSafetyWarning || false) : false;

            return res.status(200).json({
                status: true,
                msg: "Event details fetched successfully",
                event: {
                    ...liveEvent,
                    participants: undefined,
                    isCoinRush: false,
                    totalParticipants: liveEvent._count.participants,
                    hasClaimed: !!liveClaim,
                    isRedeemed: liveClaim ? liveClaim.isRedeemed : false,
                    claimId: liveClaim ? liveClaim.id : undefined,
                    agreedToSafetyWarning
                }
            });
        }

        if (coinRushEvent) {
            const coinRushParticipant = coinRushEvent.participants[0];
            const isJoined = coinRushEvent.participants.length > 0;
            const coinRushAgreedToSafetyWarning = coinRushParticipant ? (coinRushParticipant.agreedToSafetyWarning || false) : false;
            
            // Determine which checkpoint IDs are completed
            const completedCheckpointIds = coinRushEvent.progress.map(p => p.checkpointId);

            // Hide qrCode strings for security and set isAchieved status
            const safeCheckpoints = coinRushEvent.checkpoints.map(cp => {
                const { qrCode, ...rest } = cp;
                const isAchieved = completedCheckpointIds.includes(cp.id);
                return {
                    ...rest,
                    isAchieved
                };
            });

            return res.status(200).json({
                status: true,
                msg: "Event details fetched successfully",
                event: {
                    ...coinRushEvent,
                    checkpoints: safeCheckpoints,
                    participants: undefined,
                    progress: undefined,
                    isJoined,
                    agreedToSafetyWarning: coinRushAgreedToSafetyWarning,
                    isCoinRush: true,
                    totalParticipants: coinRushEvent._count.participants,
                    hasClaimed: !!coinRushClaim,
                    isRedeemed: coinRushClaim ? coinRushClaim.isRedeemed : false,
                    claimId: coinRushClaim ? coinRushClaim.id : undefined,
                    claimCode: coinRushClaim ? coinRushClaim.code : undefined
                }
            });
        }

        return res.status(404).json({
            status: false,
            msg: "Event not found"
        });

    } catch (error) {
        return res.status(500).json({
            status: false,
            msg: error.message
        });
    }
};


/**
 * @Description Join Event
 * @Route GET /api/user/events/join/:eventId
 * @Access Private (User)
 */
export const JoinEvent = async (req, res) => {
    const { id: userId } = req.user;
    const { eventId } = req.params;

    if (!eventId) {
        return res.status(400).json({
            status: false,
            msg: "Event ID is required"
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

        // 2. Only allow joining scheduled (upcoming) or live events
        if (event.status !== "scheduled" && event.status !== "live") {
            return res.status(400).json({
                status: false,
                msg: `Cannot join event. Event is currently "${event.status}" (must be "scheduled" or "live").`
            });
        }

        // 3. Check if player has already joined this event
        const existingParticipant = await prisma.liveEventParticipant.findUnique({
            where: {
                eventId_userId: {
                    eventId,
                    userId
                }
            }
        });

        if (existingParticipant) {
            return res.status(400).json({
                status: false,
                msg: "alreadyJoined"
            });
        }

        // 4. Create participant record
        const newParticipant = await prisma.liveEventParticipant.create({
            data: {
                eventId,
                userId
            }
        });

        // 4b. Increment quests_played
        await prisma.user.update({
            where: { id: userId },
            data: { quests_played: { increment: 1 } }
        });

        // 4c. Get the user's name
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
        const userName = user?.name || "A player";

        // 5. Get updated participant count
        const participantCount = await prisma.liveEventParticipant.count({
            where: { eventId }
        });

        // 6. Broadcast to all event room subscribers via uWS
        publishParticipantJoined(eventId, participantCount);
        publishCommanderMessage(
            eventId,
            `🎉 Welcome ${userName} to the event! Let's get ready! 🚀`,
            'system'
        );

        return res.status(200).json({
            status: true,
            msg: "Successfully joined the event",
            participant: newParticipant
        });

    } catch (error) {
        console.error("Join Event Error:", error);
        return res.status(500).json({
            status: false,
            msg: error.message
        });
    }
};


/**
 * @Description My Events
 * @Route GET /api/user/events/my-events
 * @Access Private (User)
 */
export const GetMyEvents = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const { status } = req.query;
    const { id: userId } = req.user;

    let statusFilter;
    if (status === "live") {
        statusFilter = "live";
    } else if (status === "scheduled") {
        statusFilter = "scheduled";
    } else if (status === "ended") {
        statusFilter = { in: ["completed", "cancelled"] };
    } else {
        statusFilter = { in: ["live", "scheduled"] };
    }

    try {
        const [events, totalEvents] = await prisma.$transaction([
            prisma.liveEvent.findMany({
                skip,
                take: limit,
                where: {
                    status: statusFilter,
                    participants: {
                        some: {
                            userId: userId
                        }
                    }
                },
                include: {
                    participants: {
                        where: {
                            userId: userId
                        }
                    }
                },
                orderBy: {
                    startTime: "asc"
                }
            }),
            prisma.liveEvent.count({
                where: {
                    status: statusFilter,
                    participants: {
                        some: {
                            userId: userId
                        }
                    }
                }
            })
        ]);

        const formattedEvents = events.map(event => {
            const isJoined = event.participants.length > 0;
            const { participants, ...eventData } = event;
            return {
                ...eventData,
                isJoined
            };
        });

        const totalPages = Math.ceil(totalEvents / limit);

        return res.status(200).json({
            status: true,
            msg: "Events fetched successfully",
            events: formattedEvents,
            pagination: {
                page,
                limit,
                totalPages,
                hasNextPage: page < totalPages
            }
        });
    } catch (error) {
        return res.status(500).json({
            status: false,
            msg: error.message
        });
    }
};


/**
 * @Description Claim Live Event Reward (QR Code Scan)
 * @Route POST /api/events/claim/:eventId
 * @Access Private
 */
export const claimLiveEventReward = async (req, res) => {
    const { id: userId } = req.user;
    const eventId = req.params.eventId;
    const { qrCodeData, userLat, userLng } = req.body;

    if (!eventId) {
        return res.status(400).json({
            status: false,
            msg: "Event ID is required"
        });
    }

    if (!qrCodeData) {
        return res.status(400).json({
            status: false,
            msg: "QR Code data is required"
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

        // 2. Validate QR Code matches the Event
        if (event.qrCode !== qrCodeData) {
            return res.status(400).json({
                status: false,
                msg: "Invalid QR Code scanned for this event"
            });
        }

        // 3. Validate Event is Live
        if (event.status !== "live") {
            return res.status(400).json({
                status: false,
                msg: `Cannot claim reward. Event is currently "${event.status}" (must be "live").`
            });
        }

        // 4. Validate Radius (Must be within 20 meters)
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

        // 5. Check if User has already claimed this event's reward
        const existingClaim = await prisma.liveEventClaim.findUnique({
            where: {
                eventId_userId: {
                    eventId,
                    userId
                }
            }
        });

        if (existingClaim) {
            if (existingClaim.isRedeemed) {
                return res.status(400).json({
                    status: false,
                    msg: "alreadyClaimed"
                });
            } else {
                // If claim exists but is not redeemed, return it as the "Winning Ticket"
                return res.status(200).json({
                    status: true,
                    msg: "success",
                    claimId: existingClaim.id,
                    code: existingClaim.code,
                    xpEarned: existingClaim.xpEarned,
                    isRedeemed: false
                });
            }
        }

        // 6. Validate Reward Stock Availability
        if (event.remainingQty <= 0) {
            return res.status(400).json({
                status: false,
                msg: "soldOut"
            });
        }

        // 7. Generate a dynamic coupon/voucher code
        const assignedCode = crypto.randomBytes(4).toString('hex').toUpperCase();
        const xpAwarded = event.xpReward || 0;

        // 8. Create temporary claim ticket (does not decrement stock yet)
        const claimDoc = await prisma.liveEventClaim.create({
            data: {
                eventId,
                userId,
                code: assignedCode,
                xpEarned: xpAwarded,
                lat: parseFloat(userLat),
                lng: parseFloat(userLng),
                isRedeemed: false
            }
        });

        return res.status(200).json({
            status: true,
            msg: "success",
            claimId: claimDoc.id,
            code: assignedCode,
            xpEarned: xpAwarded,
            isRedeemed: false
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
 * @Description Redeem Live Event Claim (Swipe to Redeem)
 * @Route POST /api/events/redeem/:claimId
 * @Access Private
 */
export const redeemLiveEventClaim = async (req, res) => {
    const { id: userId } = req.user;
    const { claimId } = req.params;

    if (!claimId) {
        return res.status(400).json({
            status: false,
            msg: "Claim ID is required"
        });
    }

    try {
        // 1. Fetch the claim details
        const claim = await prisma.liveEventClaim.findUnique({
            where: { id: claimId },
            include: { event: true }
        });

        if (!claim) {
            return res.status(404).json({
                status: false,
                msg: "Winning ticket not found"
            });
        }

        // 2. Validate ownership
        if (claim.userId !== userId) {
            return res.status(403).json({
                status: false,
                msg: "Unauthorized to redeem this ticket"
            });
        }

        // 3. Prevent duplicate redemption
        if (claim.isRedeemed) {
            return res.status(400).json({
                status: false,
                msg: "This ticket has already been redeemed"
            });
        }

        // 4. Validate event status
        if (claim.event.status !== "live") {
            return res.status(400).json({
                status: false,
                msg: `Cannot redeem reward. Event is currently "${claim.event.status}" (must be "live").`
            });
        }

        // 5. Validate reward limit/stock is available
        if (claim.event.remainingQty <= 0) {
            return res.status(400).json({
                status: false,
                msg: "Sorry, reward limit has been reached."
            });
        }

        // 6. Perform Redemption in Transaction (with level-up calculation)
        const xpAwarded = claim.xpEarned || 0;

        const userForLevel = await prisma.user.findUnique({
            where: { id: userId },
            select: { level: true, xp_progress: true }
        });

        let lv = Math.max(1, userForLevel.level);
        let bank = Math.max(0, userForLevel.xp_progress) + xpAwarded;
        const xpRequired = (level) => 100 * level * level;
        while (bank >= xpRequired(lv)) {
            bank -= xpRequired(lv);
            lv += 1;
        }

        const [updatedClaim] = await prisma.$transaction([
            prisma.liveEventClaim.update({
                where: { id: claimId },
                data: {
                    isRedeemed: true,
                    redeemedAt: new Date()
                }
            }),
            prisma.liveEvent.update({
                where: { id: claim.eventId },
                data: {
                    remainingQty: { decrement: 1 }
                }
            }),
            prisma.user.update({
                where: { id: userId },
                data: {
                    xp_earned: { increment: xpAwarded },
                    xp_progress: bank,
                    level: lv,
                    rewards_claimed: { increment: 1 }
                }
            })
        ]);

        // Fetch updated inventory count after the transaction
        const updatedEvent = await prisma.liveEvent.findUnique({
            where: { id: claim.eventId },
            select: { remainingQty: true }
        });

        // Broadcast real-time updates to event room subscribers
        publishInventoryUpdated(claim.eventId, updatedEvent.remainingQty);
        publishCommanderMessage(
            claim.eventId,
            `A player just redeemed a reward! ${updatedEvent.remainingQty} remaining.`,
            'system'
        );

        // Broadcast real-time stats update to the user
        publishToUser(userId, {
            type: 'user_stats_updated',
            xpAdded: xpAwarded,
            newXpProgress: bank,
            newLevel: lv,
            leveledUp: lv > userForLevel.level
        });

        return res.status(200).json({
            status: true,
            msg: "success",
            claim: updatedClaim
        });

    } catch (error) {
        console.error("Redeem Live Event Claim Error:", error);
        return res.status(500).json({
            status: false,
            msg: error.message || "Internal server error"
        });
    }
};
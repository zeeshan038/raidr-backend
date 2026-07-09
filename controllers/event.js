import { prisma } from "../config/db.js";
import {
    publishParticipantJoined,
    publishInventoryUpdated,
    publishCommanderMessage
} from "../sockets/eventPublisher.js";

/**
 * @Description Get events (live, scheduled, ended)
 * @Route GET /api/user/events/discovery?page=1&limit=10&status=live
 * @Access Private (User)
 */
export const GetEvents = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const { status } = req.query; // live, scheduled, ended
    const { id: userId } = req.user; // Get logged-in player ID

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
                    status: statusFilter
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
                    status: statusFilter
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
        const event = await prisma.liveEvent.findUnique({
            where: { id: eventId },
            include: {
                _count: {
                    select: { participants: true }
                }
            }
        });

        if (!event) {
            return res.status(404).json({
                status: false,
                msg: "Live Event not found"
            });
        }

        // Check if the current user has already claimed a reward for this event
        const existingClaim = await prisma.liveEventClaim.findUnique({
            where: {
                eventId_userId: { eventId, userId }
            }
        });

        return res.status(200).json({
            status: true,
            msg: "Event details fetched successfully",
            event: {
                ...event,
                totalParticipants: event._count.participants,
                hasClaimed: !!existingClaim
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

        // 5. Get updated participant count
        const participantCount = await prisma.liveEventParticipant.count({
            where: { eventId }
        });

        // 6. Broadcast to all event room subscribers via uWS
        publishParticipantJoined(eventId, participantCount);

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
        const isSurprise = event.size === 'large';
        const xpAwarded = generateDynamicXP(isSurprise);

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
                    xp_earned: { increment: xpAwarded }
                }
            })
        ]);

        // Fetch updated inventory count after the transaction
        const updatedEvent = await prisma.liveEvent.findUnique({
            where: { id: eventId },
            select: { remainingQty: true, title: true }
        });

        // Broadcast real-time updates to everyone in this event's room
        publishInventoryUpdated(eventId, updatedEvent.remainingQty);
        publishCommanderMessage(
            eventId,
            `A player just claimed a reward! ${updatedEvent.remainingQty} remaining.`,
            'system'
        );

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
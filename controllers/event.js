import crypto from 'crypto';

import { prisma } from "../config/db.js";
import {
    publishParticipantJoined,
    publishInventoryUpdated,
    publishCommanderMessage
} from "../sockets/eventPublisher.js";
import { generateDynamicXP, haversineDistance } from "../utils/methods/methods.js";

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

        // 6. Perform Redemption in Transaction
        const xpAwarded = claim.xpEarned || 0;

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
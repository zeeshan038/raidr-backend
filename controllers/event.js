import { prisma } from "../config/db.js";

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
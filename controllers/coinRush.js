import crypto from 'crypto';
import { prisma } from '../config/db.js';
import { haversineDistance } from '../utils/methods/methods.js';
import { publishToCoinRush } from '../sockets/coinRushPublisher.js';

// Custom publisher function for Coin Rush to distinct from normal live event rooms
const publishToCoinRushRoom = (eventId, payload) => {
    publishToCoinRush(eventId, payload);
};

/**
 * @Description Get all Coin Rush events (Discovery)
 * @Route GET /api/user/coin-rush/discovery
 * @Access Private (User)
 */
export const GetCoinRushEvents = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const { status } = req.query; // live, scheduled, ended

    let statusFilter;
    if (status === 'live') {
        statusFilter = 'live';
    } else if (status === 'scheduled') {
        statusFilter = 'scheduled';
    } else if (status === 'ended') {
        statusFilter = { in: ['completed', 'cancelled'] };
    } else {
        statusFilter = { in: ['live', 'scheduled'] };
    }

    try {
        const [events, totalEvents] = await prisma.$transaction([
            prisma.coinRushEvent.findMany({
                skip,
                take: limit,
                where: { status: statusFilter },
                include: {
                    participants: {
                        where: { userId: req.user.id }
                    }
                },
                orderBy: { startTime: 'asc' }
            }),
            prisma.coinRushEvent.count({
                where: { status: statusFilter }
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
            msg: "Coin Rush events fetched successfully",
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
 * @Description Get Coin Rush event details
 * @Route GET /api/user/coin-rush/details/:eventId
 * @Access Private (User)
 */
export const GetCoinRushEventDetails = async (req, res) => {
    const { eventId } = req.params;
    const userId = req.user.id;

    try {
        const event = await prisma.coinRushEvent.findUnique({
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
        });

        if (!event) {
            return res.status(404).json({
                status: false,
                msg: "Coin Rush event not found"
            });
        }

        const isJoined = event.participants.length > 0;
        
        // Hide qrCode strings for security so players can't preview them from API response
        const safeCheckpoints = event.checkpoints.map(cp => {
            const { qrCode, ...rest } = cp;
            return rest;
        });

        // Determine which checkpoint IDs are completed
        const completedCheckpointIds = event.progress.map(p => p.checkpointId);

        return res.status(200).json({
            status: true,
            msg: "Coin Rush details fetched successfully",
            event: {
                ...event,
                checkpoints: safeCheckpoints,
                participants: undefined, // remove raw relation list
                progress: undefined,     // remove raw relation list
                isJoined,
                completedCheckpointIds,
                totalParticipants: event._count.participants
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
 * @Description Join a Coin Rush Event
 * @Route POST /api/user/coin-rush/join/:eventId
 * @Access Private (User)
 */
export const JoinCoinRushEvent = async (req, res) => {
    const { eventId } = req.params;
    const userId = req.user.id;

    try {
        const event = await prisma.coinRushEvent.findUnique({
            where: { id: eventId }
        });

        if (!event) {
            return res.status(404).json({
                status: false,
                msg: "Event not found"
            });
        }

        if (event.status !== 'scheduled' && event.status !== 'live') {
            return res.status(400).json({
                status: false,
                msg: `Cannot join event in ${event.status} status`
            });
        }

        // Check if already joined
        const existingParticipant = await prisma.coinRushParticipant.findUnique({
            where: {
                eventId_userId: { eventId, userId }
            }
        });

        if (existingParticipant) {
            return res.status(400).json({
                status: false,
                msg: "Already joined this event"
            });
        }

        // Add participant
        await prisma.coinRushParticipant.create({
            data: {
                eventId,
                userId
            }
        });

        // Broadcast player joined to room
        const updatedCount = await prisma.coinRushParticipant.count({
            where: { eventId }
        });

        publishToCoinRushRoom(eventId, {
            type: 'coinrush_player_joined',
            eventId,
            userId,
            totalParticipants: updatedCount
        });

        return res.status(200).json({
            status: true,
            msg: "Successfully joined Coin Rush event"
        });
    } catch (error) {
        return res.status(500).json({
            status: false,
            msg: error.message
        });
    }
};

/**
 * @Description Submit Checkpoint Completion (GPS Proximity or QR Scan)
 * @Route POST /api/user/coin-rush/complete-checkpoint/:eventId
 * @Access Private (User)
 */
export const SubmitCheckpointCompletion = async (req, res) => {
    const { eventId } = req.params;
    const userId = req.user.id;
    const { checkpointId, lat, lng, qrCode } = req.body;

    if (!checkpointId) {
        return res.status(400).json({
            status: false,
            msg: "checkpointId is required"
        });
    }

    try {
        // Find the event
        const event = await prisma.coinRushEvent.findUnique({
            where: { id: eventId },
            include: {
                checkpoints: {
                    orderBy: { sequence: 'asc' }
                }
            }
        });

        if (!event) {
            return res.status(404).json({
                status: false,
                msg: "Event not found"
            });
        }

        if (event.status !== 'live') {
            return res.status(400).json({
                status: false,
                msg: "Checkpoint submissions are only allowed for live events"
            });
        }

        // Verify player is participant
        const isParticipant = await prisma.coinRushParticipant.findUnique({
            where: {
                eventId_userId: { eventId, userId }
            }
        });

        if (!isParticipant) {
            return res.status(400).json({
                status: false,
                msg: "You must join this event before submitting checkpoints"
            });
        }

        // Find the checkpoint
        const checkpoint = event.checkpoints.find(cp => cp.id === checkpointId);
        if (!checkpoint) {
            return res.status(404).json({
                status: false,
                msg: "Checkpoint not found in this event"
            });
        }

        // Check if already completed
        const alreadyCompleted = await prisma.coinRushProgress.findUnique({
            where: {
                eventId_userId_checkpointId: { eventId, userId, checkpointId }
            }
        });

        if (alreadyCompleted) {
            return res.status(400).json({
                status: false,
                msg: "Checkpoint already completed"
            });
        }

        // Validate type constraints
        if (event.eventType === 'GPS') {
            if (lat === undefined || lng === undefined) {
                return res.status(400).json({
                    status: false,
                    msg: "lat and lng are required for GPS checkpoints"
                });
            }
            const dist = haversineDistance(
                parseFloat(lat),
                parseFloat(lng),
                checkpoint.latitude,
                checkpoint.longitude
            );
            if (dist > 5) { // 5 meters radius check
                return res.status(400).json({
                    status: false,
                    msg: `You are not within range. Distance is ${dist.toFixed(1)} meters.`
                });
            }
        } else if (event.eventType === 'QR') {
            if (!qrCode) {
                return res.status(400).json({
                    status: false,
                    msg: "qrCode is required for QR checkpoints"
                });
            }
            if (checkpoint.qrCode !== qrCode) {
                return res.status(400).json({
                    status: false,
                    msg: "Invalid QR code"
                });
            }
        }

        // Record progress
        await prisma.coinRushProgress.create({
            data: {
                eventId,
                userId,
                checkpointId
            }
        });

        // Check if all checkpoints completed
        const completedCount = await prisma.coinRushProgress.count({
            where: { eventId, userId }
        });

        const totalCheckpoints = event.checkpointCount;
        const progressMessage = `${completedCount}/${totalCheckpoints}`;

        // Broadcast checkpoint completed
        publishToCoinRushRoom(eventId, {
            type: 'coinrush_checkpoint_completed',
            eventId,
            userId,
            checkpointId,
            sequence: checkpoint.sequence,
            progress: progressMessage
        });

        if (completedCount === totalCheckpoints) {
            // Check if there is already a winner
            const freshEvent = await prisma.coinRushEvent.findUnique({
                where: { id: eventId }
            });

            if (!freshEvent.winnerId) {
                // We have a winner! Use transaction to lock the event and declare winner
                const uniqueCode = `CLAIM-${crypto.randomBytes(4).toString('hex').toUpperCase()}-${Date.now().toString().slice(-4)}`;
                
                await prisma.$transaction([
                    prisma.coinRushEvent.update({
                        where: { id: eventId },
                        data: {
                            winnerId: userId,
                            status: 'completed',
                            endTime: new Date()
                        }
                    }),
                    prisma.coinRushClaim.create({
                        data: {
                            eventId,
                            userId,
                            code: uniqueCode
                        }
                    })
                ]);

                // Broadcast winner announced
                publishToCoinRushRoom(eventId, {
                    type: 'coinrush_winner_announced',
                    eventId,
                    winnerId: userId,
                    reward: {
                        type: event.rewardType,
                        title: event.rewardTitle,
                        value: event.rewardValue
                    }
                });

                // Broadcast event finished
                publishToCoinRushRoom(eventId, {
                    type: 'coinrush_event_finished',
                    eventId,
                    status: 'completed'
                });

                return res.status(200).json({
                    status: true,
                    msg: "Congratulations! You completed all checkpoints first and won the event!",
                    completedAll: true,
                    isWinner: true,
                    claimCode: uniqueCode
                });
            } else {
                // Completed but not the winner
                return res.status(200).json({
                    status: true,
                    msg: "You completed all checkpoints, but someone else won first.",
                    completedAll: true,
                    isWinner: false
                });
            }
        }

        return res.status(200).json({
            status: true,
            msg: `Checkpoint ${checkpoint.sequence} completed successfully`,
            completedAll: false,
            progress: progressMessage
        });

    } catch (error) {
        return res.status(500).json({
            status: false,
            msg: error.message
        });
    }
};

/**
 * @Description Swipe and redeem Coin Rush claim (Zero-Touch)
 * @Route POST /api/user/coin-rush/redeem/:claimId
 * @Access Private (User/Merchant verification context)
 */
export const RedeemCoinRushClaim = async (req, res) => {
    const { claimId } = req.params;

    try {
        const claim = await prisma.coinRushClaim.findUnique({
            where: { id: claimId },
            include: {
                event: true,
                user: true
            }
        });

        if (!claim) {
            return res.status(404).json({
                status: false,
                msg: "Claim not found"
            });
        }

        if (claim.isRedeemed) {
            return res.status(400).json({
                status: false,
                msg: "This reward has already been redeemed"
            });
        }

        // Perform redemption update
        const updatedClaim = await prisma.coinRushClaim.update({
            where: { id: claimId },
            data: {
                isRedeemed: true,
                redeemedAt: new Date()
            }
        });

        return res.status(200).json({
            status: true,
            msg: "Reward successfully redeemed!",
            claim: updatedClaim
        });
    } catch (error) {
        return res.status(500).json({
            status: false,
            msg: error.message
        });
    }
};

import crypto from 'crypto';
import { prisma } from '../config/db.js';
import { haversineDistance, isSameCountryOrClose } from '../utils/methods/methods.js';
import { publishToCoinRush } from '../sockets/coinRushPublisher.js';
import { publishToUser } from '../sockets/eventPublisher.js';

// Custom publisher function for Coin Rush to distinct from normal live event rooms
const publishToCoinRushRoom = (eventId, payload) => {
    publishToCoinRush(eventId, payload);
};

const getCoinRushLeaderboard = async (eventId) => {
    const participants = await prisma.coinRushParticipant.findMany({
        where: { eventId },
        include: {
            user: {
                select: { id: true, name: true, photoUrl: true }
            }
        }
    });

    const progressStats = await prisma.coinRushProgress.groupBy({
        by: ['userId'],
        where: { eventId },
        _count: { checkpointId: true },
        _max: { completedAt: true }
    });

    const leaderboard = participants.map(p => {
        const stat = progressStats.find(s => s.userId === p.userId);
        return {
            userId: p.userId,
            name: p.user.name || "A player",
            photoUrl: p.user.photoUrl || "",
            coins: stat ? stat._count.checkpointId : 0,
            lastCompletedAt: stat && stat._max.completedAt ? stat._max.completedAt.getTime() : 0,
            joinedAt: p.joinedAt.getTime()
        };
    });

    leaderboard.sort((a, b) => {
        if (b.coins !== a.coins) {
            return b.coins - a.coins;
        }
        if (a.coins > 0) {
            return a.lastCompletedAt - b.lastCompletedAt;
        }
        return a.joinedAt - b.joinedAt;
    });

    leaderboard.forEach((entry, index) => {
        entry.rank = index + 1;
    });

    return leaderboard;
};

const broadcastCoinRushLeaderboard = async (eventId) => {
    try {
        const leaderboard = await getCoinRushLeaderboard(eventId);
        publishToCoinRushRoom(eventId, {
            type: 'coinrush_leaderboard_updated',
            eventId,
            leaderboard
        });
    } catch (err) {
        console.error('[CoinRush] Error broadcasting leaderboard:', err);
    }
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
        const events = await prisma.coinRushEvent.findMany({
            where: { status: statusFilter },
            include: {
                participants: {
                    where: { userId: req.user.id }
                }
            }
        });

        const formattedEvents = events.map(event => {
            const isJoined = event.participants.length > 0;
            const { participants, ...eventData } = event;
            return {
                ...eventData,
                isJoined
            };
        });

        const userLat = req.user.lat ? parseFloat(req.user.lat) : null;
        const userLng = req.user.long ? parseFloat(req.user.long) : null;

        let filteredEvents = formattedEvents;

        if (userLat !== null && !isNaN(userLat) && userLng !== null && !isNaN(userLng)) {
            // Filter by same country or proximity
            filteredEvents = formattedEvents.filter(event => {
                if (event.centerLat === null || event.centerLng === null || event.centerLat === undefined || event.centerLng === undefined) {
                    return true;
                }
                return isSameCountryOrClose(userLat, userLng, event.centerLat, event.centerLng);
            });

            // Calculate distance and sort nearest to farthest
            filteredEvents = filteredEvents.map(event => {
                const distance = (event.centerLat !== null && event.centerLng !== null && event.centerLat !== undefined && event.centerLng !== undefined)
                    ? haversineDistance(userLat, userLng, event.centerLat, event.centerLng)
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
            msg: "Coin Rush events fetched successfully",
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

        const participant = event.participants[0];
        const isJoined = event.participants.length > 0;
        const agreedToSafetyWarning = participant ? (participant.agreedToSafetyWarning || false) : false;
        
        // Determine which checkpoint IDs are completed
        const completedCheckpointIds = event.progress.map(p => p.checkpointId);

        // Hide qrCode strings for security and set isAchieved status
        const safeCheckpoints = event.checkpoints.map(cp => {
            const { qrCode, ...rest } = cp;
            const isAchieved = completedCheckpointIds.includes(cp.id);
            return {
                ...rest,
                isAchieved
            };
        });

        const leaderboard = await getCoinRushLeaderboard(eventId);

        return res.status(200).json({
            status: true,
            msg: "Coin Rush details fetched successfully",
            event: {
                ...event,
                checkpoints: safeCheckpoints,
                participants: undefined, 
                progress: undefined,    
                isJoined,
                agreedToSafetyWarning,
                totalParticipants: event._count.participants,
                leaderboard
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

        // Get the user's name for the commander message
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
        const userName = user?.name || "A player";

        publishToCoinRushRoom(eventId, {
            type: 'event_commander_message',
            eventId,
            text: `🎉 Welcome ${userName} to the coin rush! Let's get ready! 🚀`,
            sender: 'system'
        });

        // Broadcast updated leaderboard
        await broadcastCoinRushLeaderboard(eventId);

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
    const { checkpointId, lat, lng, qrCode, answer, secretCode, photoUrl } = req.body;

    if (!checkpointId && !qrCode) {
        return res.status(400).json({
            status: false,
            msg: "Either checkpointId or qrCode is required"
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

        // Find the checkpoint (by qrCode for QR events, otherwise by checkpointId)
        let checkpoint;
        if (qrCode) {
            checkpoint = event.checkpoints.find(cp => cp.qrCode === qrCode);
        } else if (checkpointId) {
            checkpoint = event.checkpoints.find(cp => cp.id === checkpointId);
        }

        if (!checkpoint) {
            return res.status(404).json({
                status: false,
                msg: "Checkpoint not found in this event"
            });
        }

        const actualCheckpointId = checkpoint.id;

        // Check if already completed
        const alreadyCompleted = await prisma.coinRushProgress.findUnique({
            where: {
                eventId_userId_checkpointId: { eventId, userId, checkpointId: actualCheckpointId }
            }
        });

        if (alreadyCompleted) {
            return res.status(400).json({
                status: false,
                msg: "Checkpoint already completed"
            });
        }

        // Validate type constraints
        if (checkpoint.type === 'GPS') {
            if (!checkpointId) {
                return res.status(400).json({
                    status: false,
                    msg: "checkpointId is required for GPS checkpoints"
                });
            }
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
            if (dist > 15) { // 15 meters radius check
                return res.status(400).json({
                    status: false,
                    msg: `You are not within range. Distance is ${dist.toFixed(1)} meters.`
                });
            }
        } else if (checkpoint.type === 'QR') {
            if (!qrCode) {
                return res.status(400).json({
                    status: false,
                    msg: "qrCode is required for QR checkpoints"
                });
            }
        } else if (checkpoint.type === 'QNA') {
            if (!answer) {
                return res.status(400).json({ status: false, msg: "answer is required for Q&A checkpoints" });
            }
            if (answer.trim().toLowerCase() !== (checkpoint.answer || "").trim().toLowerCase()) {
                return res.status(400).json({ status: false, msg: "Incorrect answer" });
            }
        } else if (checkpoint.type === 'SECRET_CODE') {
            if (!secretCode) {
                return res.status(400).json({ status: false, msg: "secretCode is required" });
            }
            if (secretCode.trim() !== (checkpoint.secretCode || "").trim()) {
                return res.status(400).json({ status: false, msg: "Invalid secret code" });
            }
        } else if (checkpoint.type === 'PHOTO') {
            if (!photoUrl) {
                return res.status(400).json({ status: false, msg: "photoUrl is required for PHOTO checkpoints" });
            }
            // For now, accept the photo URL as completion. AI fraud detection can be added here later.
        }

        // Record progress and update user stats (XP / Level)
        const xpAmount = checkpoint.xp || Math.floor(Math.random() * (200 - 50 + 1)) + 50;
        let levelData = { level: 1, xp_progress: 0, leveledUp: false, bank: 0 };

        await prisma.$transaction(async (tx) => {
            await tx.coinRushProgress.create({
                data: {
                    eventId,
                    userId,
                    checkpointId: actualCheckpointId
                }
            });

            const user = await tx.user.findUnique({
                where: { id: userId },
                select: { level: true, xp_progress: true }
            });

            if (user) {
                let lv = Math.max(1, user.level);
                let bank = Math.max(0, user.xp_progress) + xpAmount;
                const xpRequired = (level) => 100 * level * level;

                while (bank >= xpRequired(lv)) {
                    bank -= xpRequired(lv);
                    lv += 1;
                }

                await tx.user.update({
                    where: { id: userId },
                    data: {
                        xp_earned: { increment: xpAmount },
                        xp_progress: bank,
                        level: lv,
                        raidrCoins: { increment: 1 }
                    }
                });

                levelData = {
                    level: lv,
                    xp_progress: bank,
                    leveledUp: lv > user.level,
                    bank
                };
            }
        });

        // Check if all checkpoints completed
        const completedCount = await prisma.coinRushProgress.count({
            where: { eventId, userId }
        });

        // Find out how many people are ahead of them
        const progressStats = await prisma.coinRushProgress.groupBy({
            by: ['userId'],
            where: { eventId },
            _count: { checkpointId: true }
        });

        const usersAhead = progressStats.filter(stat => stat._count.checkpointId > completedCount).length;
        let responseMsg = `Checkpoint ${checkpoint.sequence} completed successfully`;
        if (usersAhead > 0) {
            responseMsg = `⚡ Hurry up! ${usersAhead} people are collecting coins faster than you. Complete the next checkpoint to catch up!`;
        } else {
            responseMsg = `🏆 Great job! You're ahead of everyone else. Keep it up and complete all the checkpoints to stay on top!`;
        }

        const totalCheckpoints = event.checkpointCount;
        const progressMessage = `${completedCount}/${totalCheckpoints}`;

        // Broadcast real-time stats update to the user
        publishToUser(userId, {
            type: 'user_stats_updated',
            xpAdded: xpAmount,
            coinsAdded: 1,
            newXpProgress: levelData.bank,
            newLevel: levelData.level,
            leveledUp: levelData.leveledUp
        });

        // Broadcast checkpoint completed
        publishToCoinRushRoom(eventId, {
            type: 'coinrush_checkpoint_completed',
            eventId,
            userId,
            checkpointId: actualCheckpointId,
            sequence: checkpoint.sequence,
            progress: progressMessage
        });

        // Broadcast updated leaderboard
        await broadcastCoinRushLeaderboard(eventId);

        if (completedCount === totalCheckpoints) {
            const freshEvent = await prisma.coinRushEvent.findUnique({
                where: { id: eventId }
            });

            if (!freshEvent.winnerId) {
                const uniqueCode = `CLAIM-${crypto.randomBytes(4).toString('hex').toUpperCase()}-${Date.now().toString().slice(-4)}`;
                
                const [_, newClaim] = await prisma.$transaction([
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
                    winnerName: req.user.name || "",
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
                    claimId: newClaim.id,
                    claimCode: uniqueCode,
                    isAchieved: true,
                    xpEarned: xpAmount
                });
            } else {
                // Completed but not the winner
                return res.status(200).json({
                    status: true,
                    msg: "You completed all checkpoints, but someone else won first.",
                    completedAll: true,
                    isWinner: false,
                    isAchieved: true,
                    xpEarned: xpAmount
                });
            }
        }

        return res.status(200).json({
            status: true,
            msg: responseMsg,
            completedAll: false,
            progress: progressMessage,
            isAchieved: true,
            xpEarned: xpAmount
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


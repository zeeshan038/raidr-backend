import crypto from 'crypto';
import { prisma } from '../../config/db.js';

// Helper to generate random coordinates within a radius (in meters)
const generateRandomCoordinates = (centerLat, centerLng, radiusMeter, count) => {
    const checkpoints = [];
    const R = 6378137; // Earth radius in meters
    for (let i = 1; i <= count; i++) {
        // Random distance and bearing
        const r = Math.random() * radiusMeter;
        const theta = Math.random() * 2 * Math.PI;

        const dLat = (r * Math.cos(theta)) / R;
        const dLng = (r * Math.sin(theta)) / (R * Math.cos((centerLat * Math.PI) / 180));

        const checkpointLat = centerLat + dLat * (180 / Math.PI);
        const checkpointLng = centerLng + dLng * (180 / Math.PI);

        checkpoints.push({
            sequence: i,
            latitude: checkpointLat,
            longitude: checkpointLng,
            description: `Checkpoint ${i}`
        });
    }
    return checkpoints;
};

/**
 * @Description Create new Coin Rush event and its checkpoints
 * @Route POST /api/merchant/coin-rush/create
 * @Access Private (Merchant)
 */
export const CreateCoinRushEvent = async (req, res) => {
    const { id: merchantId } = req.merchant;
    const {
        title,
        description,
        eventType,
        checkpointCount = 5,
        duration,
        startTime,
        endTime,
        // For GPS Auto
        centerLat,
        centerLng,
        radiusMeter,
        // For GPS Manual
        checkpoints: manualCheckpoints,
        // Reward fields
        rewardType,
        rewardTitle,
        rewardImageUrl = '',
        rewardDescription = '',
        rewardClaimInstructions = '',
        rewardValue = 0.0
    } = req.body;

    if (!title || !description || !eventType || !duration || !rewardType || !rewardTitle) {
        return res.status(400).json({
            status: false,
            msg: "Missing required fields (title, description, eventType, duration, rewardType, rewardTitle)"
        });
    }

    if (checkpointCount < 3 || checkpointCount > 10) {
        return res.status(400).json({
            status: false,
            msg: "Checkpoint count must be between 3 and 10"
        });
    }

    const parsedStart = startTime ? new Date(startTime) : new Date();
    const parsedEnd = endTime ? new Date(endTime) : new Date(parsedStart.getTime() + duration * 60 * 1000);

    if (parsedEnd <= parsedStart) {
        return res.status(400).json({
            status: false,
            msg: "End time must be after start time"
        });
    }

    try {
        let createdCheckpoints = [];

        if (eventType === 'GPS') {
            if (centerLat !== undefined && centerLng !== undefined && radiusMeter !== undefined) {
                // Auto generate
                createdCheckpoints = generateRandomCoordinates(
                    parseFloat(centerLat),
                    parseFloat(centerLng),
                    parseFloat(radiusMeter),
                    checkpointCount
                );
            } else if (Array.isArray(manualCheckpoints) && manualCheckpoints.length > 0) {
                // Manual placement
                if (manualCheckpoints.length !== checkpointCount) {
                    return res.status(400).json({
                        status: false,
                        msg: `Provided checkpoints length (${manualCheckpoints.length}) does not match checkpointCount (${checkpointCount})`
                    });
                }
                createdCheckpoints = manualCheckpoints.map((cp, idx) => ({
                    sequence: idx + 1,
                    latitude: parseFloat(cp.latitude),
                    longitude: parseFloat(cp.longitude),
                    description: cp.description || `Checkpoint ${idx + 1}`
                }));
            } else {
                return res.status(400).json({
                    status: false,
                    msg: "For GPS events, either center points (centerLat, centerLng, radiusMeter) or manual checkpoints are required."
                });
            }
        } else if (eventType === 'QR') {
            for (let i = 1; i <= checkpointCount; i++) {
                createdCheckpoints.push({
                    sequence: i,
                    qrCode: `cr_${crypto.randomBytes(12).toString('hex')}`,
                    description: `Checkpoint ${i}`
                });
            }
        } else {
            return res.status(400).json({
                status: false,
                msg: "Invalid eventType. Must be GPS or QR"
            });
        }

        const newEvent = await prisma.coinRushEvent.create({
            data: {
                title,
                description,
                merchantId,
                eventType,
                checkpointCount,
                duration: parseInt(duration),
                startTime: parsedStart,
                endTime: parsedEnd,
                centerLat: centerLat ? parseFloat(centerLat) : null,
                centerLng: centerLng ? parseFloat(centerLng) : null,
                radiusMeter: radiusMeter ? parseFloat(radiusMeter) : null,
                rewardType,
                rewardTitle,
                rewardImageUrl,
                rewardDescription,
                rewardClaimInstructions,
                rewardValue: parseFloat(rewardValue),
                status: "scheduled", // default active status
                checkpoints: {
                    create: createdCheckpoints
                }
            },
            include: {
                checkpoints: true
            }
        });

        return res.status(201).json({
            status: true,
            msg: "Coin Rush event created successfully",
            event: newEvent
        });

    } catch (error) {
        return res.status(500).json({
            status: false,
            msg: error.message
        });
    }
};

/**
 * @Description Get all Coin Rush events created by the logged-in merchant
 * @Route GET /api/merchant/coin-rush/my-events
 * @Access Private (Merchant)
 */
export const GetMerchantCoinRushEvents = async (req, res) => {
    const { id: merchantId } = req.merchant;

    try {
        const events = await prisma.coinRushEvent.findMany({
            where: { merchantId },
            include: {
                checkpoints: {
                    orderBy: { sequence: 'asc' }
                },
                _count: {
                    select: { participants: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        return res.status(200).json({
            status: true,
            msg: "Merchant Coin Rush events fetched successfully",
            events: events.map(e => ({
                ...e,
                totalParticipants: e._count.participants
            }))
        });
    } catch (error) {
        return res.status(500).json({
            status: false,
            msg: error.message
        });
    }
};

/**
 * @Description Retrieve generated QR codes for a QR event
 * @Route GET /api/merchant/coin-rush/qr-codes/:eventId
 * @Access Private (Merchant)
 */
export const GetCoinRushQRCheckpoints = async (req, res) => {
    const { id: merchantId } = req.merchant;
    const { eventId } = req.params;

    try {
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

        if (event.merchantId !== merchantId) {
            return res.status(403).json({
                status: false,
                msg: "Forbidden: You do not own this event"
            });
        }

        if (event.eventType !== 'QR') {
            return res.status(400).json({
                status: false,
                msg: "This event does not use QR checkpoints"
            });
        }

        return res.status(200).json({
            status: true,
            msg: "QR Checkpoints retrieved successfully",
            checkpoints: event.checkpoints
        });
    } catch (error) {
        return res.status(500).json({
            status: false,
            msg: error.message
        });
    }
};

/**
 * @Description Update Draft/Scheduled Event
 * @Route PUT /api/merchant/coin-rush/update/:eventId
 * @Access Private (Merchant)
 */
export const UpdateCoinRushEvent = async (req, res) => {
    const { id: merchantId } = req.merchant;
    const { eventId } = req.params;
    const updateData = req.body;

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

        if (event.merchantId !== merchantId) {
            return res.status(403).json({
                status: false,
                msg: "Forbidden"
            });
        }

        const updatedEvent = await prisma.coinRushEvent.update({
            where: { id: eventId },
            data: updateData
        });

        return res.status(200).json({
            status: true,
            msg: "Event updated successfully",
            event: updatedEvent
        });
    } catch (error) {
        return res.status(500).json({
            status: false,
            msg: error.message
        });
    }
};

/**
 * @Description Delete Coin Rush event
 * @Route DELETE /api/merchant/coin-rush/delete/:eventId
 * @Access Private (Merchant)
 */
export const DeleteCoinRushEvent = async (req, res) => {
    const { id: merchantId } = req.merchant;
    const { eventId } = req.params;

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

        if (event.merchantId !== merchantId) {
            return res.status(403).json({
                status: false,
                msg: "Forbidden"
            });
        }

        await prisma.coinRushEvent.delete({
            where: { id: eventId }
        });

        return res.status(200).json({
            status: true,
            msg: "Coin Rush event deleted successfully"
        });
    } catch (error) {
        return res.status(500).json({
            status: false,
            msg: error.message
        });
    }
};

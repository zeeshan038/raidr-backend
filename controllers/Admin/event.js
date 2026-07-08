import { prisma } from "../../config/db.js";

const EVENT_COSTS = {
    small: 10,
    medium: 25,
    large: 50
};

/**
 * @description Get all pending approval Live Events
 * @Route GET /api/admin/events/pending
 * @Access Private (Admin)
 */
export const getPendingEvents = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    try {
        const [events, totalCount] = await Promise.all([
            prisma.liveEvent.findMany({
                where: { status: "pending_approval" },
                include: {
                    merchant: {
                        select: {
                            id: true,
                            name: true,
                            businessName: true,
                            email: true
                        }
                    }
                },
                skip,
                take: limit,
                orderBy: { createdAt: "desc" }
            }),
            prisma.liveEvent.count({
                where: { status: "pending_approval" }
            })
        ]);

        return res.status(200).json({
            status: true,
            msg: "Pending approval events fetched successfully",
            events,
            pagination: {
                page,
                limit,
                totalPages: Math.ceil(totalCount / limit),
                totalCount
            }
        });
    } catch (error) {
        console.error("Get Pending Events Error:", error);
        return res.status(500).json({
            status: false,
            msg: error.message || "Internal server error"
        });
    }
};

/**
 * @description Approve a pending Live Event
 * @Route POST /api/admin/events/approve/:id
 * @Access Private (Admin)
 */
export const approveEvent = async (req, res) => {
    const { id } = req.params;

    try {
        const event = await prisma.liveEvent.findUnique({
            where: { id }
        });

        if (!event) {
            return res.status(404).json({
                status: false,
                msg: "Live Event not found"
            });
        }

        if (event.status !== "pending_approval") {
            return res.status(400).json({
                status: false,
                msg: `Event cannot be approved because its current status is "${event.status}"`
            });
        }

        const approvedEvent = await prisma.liveEvent.update({
            where: { id },
            data: { status: "scheduled" }
        });

        return res.status(200).json({
            status: true,
            msg: "Event approved and scheduled successfully",
            event: approvedEvent
        });
    } catch (error) {
        console.error("Approve Event Error:", error);
        return res.status(500).json({
            status: false,
            msg: error.message || "Internal server error"
        });
    }
};

/**
 * @description Reject a pending Live Event (Refunds Credits)
 * @Route POST /api/admin/events/reject/:id
 * @Access Private (Admin)
 */
export const rejectEvent = async (req, res) => {
    const { id } = req.params;

    try {
        const event = await prisma.liveEvent.findUnique({
            where: { id }
        });

        if (!event) {
            return res.status(404).json({
                status: false,
                msg: "Live Event not found"
            });
        }

        if (event.status !== "pending_approval") {
            return res.status(400).json({
                status: false,
                msg: `Event cannot be rejected because its current status is "${event.status}"`
            });
        }

        const refundCost = EVENT_COSTS[event.size] || 0;

        // Perform refund and update status in transaction
        const [updatedMerchant, rejectedEvent] = await prisma.$transaction([
            prisma.merchant.update({
                where: { id: event.merchantId },
                data: {
                    credits: { increment: refundCost }
                }
            }),
            prisma.liveEvent.update({
                where: { id },
                data: { status: "cancelled" }
            })
        ]);

        // Create log entry
        if (refundCost > 0) {
            await prisma.merchantCreditLog.create({
                data: {
                    merchantId: event.merchantId,
                    amount: refundCost,
                    type: "refund",
                    description: `Refunded ${refundCost} credits for rejected ${event.size} event "${event.title}"`,
                    eventId: event.id
                }
            });
        }

        return res.status(200).json({
            status: true,
            msg: `Event rejected successfully. Refunded ${refundCost} credits to merchant.`,
            event: rejectedEvent
        });
    } catch (error) {
        console.error("Reject Event Error:", error);
        return res.status(500).json({
            status: false,
            msg: error.message || "Internal server error"
        });
    }
};

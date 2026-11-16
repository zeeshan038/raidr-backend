import { prisma } from "../../config/db.js";
import {
    createLiveEvent,
    updateLiveEvent,
    deleteEvent as merchantDeleteEvent,
} from "../Merchant/event.js";

const EVENT_COSTS = {
    small: 10,
    medium: 25,
    large: 50
};

const attachMerchantContext = async (req, res) => {
    const merchantId = req.body?.merchantId || req.query?.merchantId;
    if (!merchantId) {
        res.status(400).json({ status: false, msg: "merchantId is required" });
        return null;
    }
    const merchant = await prisma.merchant.findUnique({
        where: { id: merchantId },
        select: { id: true, name: true, businessName: true, email: true, credits: true },
    });
    if (!merchant) {
        res.status(404).json({ status: false, msg: "Merchant not found" });
        return null;
    }
    req.merchant = merchant;
    req.createdByAdmin = true;
    return merchant;
};

/**
 * @description Admin creates a multiplayer live event for a merchant
 * @Route POST /api/admin/events/create
 */
export const adminCreateLiveEvent = async (req, res) => {
    try {
        const merchant = await attachMerchantContext(req, res);
        if (!merchant) return;
        const { merchantId, ...payload } = req.body;
        req.body = payload;
        return createLiveEvent(req, res);
    } catch (error) {
        console.error("Admin Create Live Event Error:", error);
        return res.status(500).json({ status: false, msg: error.message || "Internal server error" });
    }
};

/**
 * @description Admin get live event by id
 * @Route GET /api/admin/events/specific-event/:eventId
 */
export const adminGetEventById = async (req, res) => {
    try {
        const { eventId } = req.params;
        const event = await prisma.liveEvent.findUnique({
            where: { id: eventId },
            include: {
                merchant: {
                    select: { id: true, name: true, businessName: true, email: true, photoUrl: true },
                },
                claims: {
                    include: {
                        user: {
                            select: { name: true, email: true, photoUrl: true },
                        },
                    },
                    orderBy: { claimedAt: "desc" },
                },
            },
        });

        if (!event) {
            return res.status(404).json({ status: false, msg: "Event not found" });
        }

        return res.status(200).json({
            status: true,
            msg: "Event fetched successfully",
            event,
        });
    } catch (error) {
        console.error("Admin Get Event Error:", error);
        return res.status(500).json({ status: false, msg: error.message || "Internal server error" });
    }
};

/**
 * @description Admin update live event
 * @Route PUT /api/admin/events/update-event/:eventId
 */
export const adminUpdateLiveEvent = async (req, res) => {
    try {
        const { eventId } = req.params;
        const existing = await prisma.liveEvent.findUnique({ where: { id: eventId } });
        if (!existing) {
            return res.status(404).json({ status: false, msg: "Event not found" });
        }
        if (!existing.merchantId) {
            return res.status(400).json({ status: false, msg: "Event has no merchant owner" });
        }
        req.merchant = { id: existing.merchantId };
        req.createdByAdmin = true;
        return updateLiveEvent(req, res);
    } catch (error) {
        console.error("Admin Update Live Event Error:", error);
        return res.status(500).json({ status: false, msg: error.message || "Internal server error" });
    }
};

/**
 * @description Admin delete live event
 * @Route DELETE /api/admin/events/delete/:eventId
 */
export const adminDeleteLiveEvent = async (req, res) => {
    try {
        const { eventId } = req.params;
        const existing = await prisma.liveEvent.findUnique({ where: { id: eventId } });
        if (!existing) {
            return res.status(404).json({ status: false, msg: "Event not found" });
        }
        if (!existing.merchantId) {
            return res.status(400).json({ status: false, msg: "Event has no merchant owner" });
        }
        req.merchant = { id: existing.merchantId };
        return merchantDeleteEvent(req, res);
    } catch (error) {
        console.error("Admin Delete Live Event Error:", error);
        return res.status(500).json({ status: false, msg: error.message || "Internal server error" });
    }
};

/**
 * @description Get all  Live Events
 * @Route GET /api/admin/events/pending?status
 * @Access Private (Admin)
 */
export const getAllEvents = async (req, res) => {
    const {status}= req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const whereClause = status ? { status } : {};

    try {
        const [events, totalCount] = await Promise.all([
            prisma.liveEvent.findMany({
                where: whereClause,
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
                where: whereClause
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
        console.error("Get Pending Events Error:", error);
        return res.status(500).json({
            status: false,
            msg: error.message
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

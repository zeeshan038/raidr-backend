import { prisma } from "../../config/db.js";
import {
    CreateCoinRushEvent,
    CreateHybridCoinRushEvent,
    UpdateCoinRushEvent,
    DeleteCoinRushEvent,
    GetCoinRushQRCheckpoints,
} from "../Merchant/coinRush.js";

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
 * @description Admin create coin rush for a merchant
 * @Route POST /api/admin/coin-rush/create
 */
export const adminCreateCoinRush = async (req, res) => {
    try {
        const merchant = await attachMerchantContext(req, res);
        if (!merchant) return;
        const { merchantId, ...payload } = req.body;
        req.body = payload;
        return CreateCoinRushEvent(req, res);
    } catch (error) {
        console.error("Admin Create Coin Rush Error:", error);
        return res.status(500).json({ status: false, msg: error.message || "Internal server error" });
    }
};

/**
 * @description Admin create hybrid coin rush for a merchant
 * @Route POST /api/admin/coin-rush/hybrid/create
 */
export const adminCreateHybridCoinRush = async (req, res) => {
    try {
        const merchant = await attachMerchantContext(req, res);
        if (!merchant) return;
        const { merchantId, ...payload } = req.body;
        req.body = payload;
        return CreateHybridCoinRushEvent(req, res);
    } catch (error) {
        console.error("Admin Create Hybrid Coin Rush Error:", error);
        return res.status(500).json({ status: false, msg: error.message || "Internal server error" });
    }
};

/**
 * @description Admin update coin rush
 * @Route PUT /api/admin/coin-rush/update/:eventId
 */
export const adminUpdateCoinRush = async (req, res) => {
    try {
        const { eventId } = req.params;
        const existing = await prisma.coinRushEvent.findUnique({ where: { id: eventId } });
        if (!existing) {
            return res.status(404).json({ status: false, msg: "Coin rush event not found" });
        }
        req.merchant = { id: existing.merchantId };
        return UpdateCoinRushEvent(req, res);
    } catch (error) {
        console.error("Admin Update Coin Rush Error:", error);
        return res.status(500).json({ status: false, msg: error.message || "Internal server error" });
    }
};

/**
 * @description Admin delete coin rush
 * @Route DELETE /api/admin/coin-rush/delete/:eventId
 */
export const adminDeleteCoinRush = async (req, res) => {
    try {
        const { eventId } = req.params;
        const existing = await prisma.coinRushEvent.findUnique({ where: { id: eventId } });
        if (!existing) {
            return res.status(404).json({ status: false, msg: "Coin rush event not found" });
        }
        req.merchant = { id: existing.merchantId };
        return DeleteCoinRushEvent(req, res);
    } catch (error) {
        console.error("Admin Delete Coin Rush Error:", error);
        return res.status(500).json({ status: false, msg: error.message || "Internal server error" });
    }
};

/**
 * @description Admin get QR checkpoints
 * @Route GET /api/admin/coin-rush/qr-codes/:eventId
 */
export const adminGetCoinRushQRCheckpoints = async (req, res) => {
    try {
        const { eventId } = req.params;
        const existing = await prisma.coinRushEvent.findUnique({ where: { id: eventId } });
        if (!existing) {
            return res.status(404).json({ status: false, msg: "Coin rush event not found" });
        }
        req.merchant = { id: existing.merchantId };
        return GetCoinRushQRCheckpoints(req, res);
    } catch (error) {
        console.error("Admin Get Coin Rush QR Error:", error);
        return res.status(500).json({ status: false, msg: error.message || "Internal server error" });
    }
};

/**
 * @description List all Coin Rush events for admin
 * @Route GET /api/admin/coin-rush/all
 * @Access Private (Admin)
 */
export const getAllCoinRushEvents = async (req, res) => {
    const { status } = req.query;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const whereClause = status ? { status } : {};

    try {
        const [events, totalCount] = await Promise.all([
            prisma.coinRushEvent.findMany({
                where: whereClause,
                include: {
                    merchant: {
                        select: {
                            id: true,
                            name: true,
                            businessName: true,
                            email: true,
                        },
                    },
                    _count: {
                        select: {
                            checkpoints: true,
                            participants: true,
                            claims: true,
                        },
                    },
                },
                skip,
                take: limit,
                orderBy: { createdAt: "desc" },
            }),
            prisma.coinRushEvent.count({ where: whereClause }),
        ]);

        return res.status(200).json({
            status: true,
            msg: "Coin rush events fetched successfully",
            events: events.map((e) => ({
                ...e,
                checkpointCount: e.checkpointCount || e._count?.checkpoints || 0,
                totalParticipants: e._count?.participants || 0,
                totalClaims: e._count?.claims || 0,
            })),
            pagination: {
                page,
                limit,
                totalPages: Math.ceil(totalCount / limit),
                totalCount,
            },
        });
    } catch (error) {
        console.error("Get All Coin Rush Events Error:", error);
        return res.status(500).json({
            status: false,
            msg: error.message || "Internal server error",
        });
    }
};

/**
 * @description Approve a pending Coin Rush event
 * @Route POST /api/admin/coin-rush/approve/:id
 */
export const approveCoinRushEvent = async (req, res) => {
    const { id } = req.params;

    try {
        const event = await prisma.coinRushEvent.findUnique({ where: { id } });

        if (!event) {
            return res.status(404).json({ status: false, msg: "Coin rush event not found" });
        }

        if (event.status !== "pending_approval") {
            return res.status(400).json({
                status: false,
                msg: `Event cannot be approved because its current status is "${event.status}"`,
            });
        }

        const approvedEvent = await prisma.coinRushEvent.update({
            where: { id },
            data: { status: "scheduled" },
        });

        return res.status(200).json({
            status: true,
            msg: "Coin rush event approved and scheduled successfully",
            event: approvedEvent,
        });
    } catch (error) {
        console.error("Approve Coin Rush Error:", error);
        return res.status(500).json({
            status: false,
            msg: error.message || "Internal server error",
        });
    }
};

/**
 * @description Reject a pending Coin Rush event
 * @Route POST /api/admin/coin-rush/reject/:id
 */
export const rejectCoinRushEvent = async (req, res) => {
    const { id } = req.params;

    try {
        const event = await prisma.coinRushEvent.findUnique({ where: { id } });

        if (!event) {
            return res.status(404).json({ status: false, msg: "Coin rush event not found" });
        }

        if (event.status !== "pending_approval") {
            return res.status(400).json({
                status: false,
                msg: `Event cannot be rejected because its current status is "${event.status}"`,
            });
        }

        const rejectedEvent = await prisma.coinRushEvent.update({
            where: { id },
            data: { status: "cancelled" },
        });

        return res.status(200).json({
            status: true,
            msg: "Coin rush event rejected successfully",
            event: rejectedEvent,
        });
    } catch (error) {
        console.error("Reject Coin Rush Error:", error);
        return res.status(500).json({
            status: false,
            msg: error.message || "Internal server error",
        });
    }
};

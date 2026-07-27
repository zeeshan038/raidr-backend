import { prisma } from "../config/db.js";

/**
 * @Description Get all rewards for a user (Boxes/Route Stops/Surprise Me, Live Events, Coin Rush, Merchant Ads)
 * @Route GET /api/rewards/all
 * @Access Private
 */
export const getAllRewards = async (req, res) => {
    const { id: userId } = req.user;
    const { source, type, category } = req.query;

    const filterType = (type || category || 'all').toLowerCase();

    try {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            return res.status(404).json({
                status: false,
                msg: "User not found"
            });
        }

        const details = {};

        // 1. Fetch Box Collections (Route Stops, Mystery Boxes, Surprise Me)
        if (filterType === 'all' || filterType === 'boxes' || filterType === 'box') {
            const boxWhereClause = { userId };
            if (source) {
                boxWhereClause.source = source;
            }

            details.boxes = await prisma.boxCollectionLog.findMany({
                where: boxWhereClause,
                orderBy: { createdAt: 'desc' }
            });
        }

        // 2. Fetch Live Event Claims
        if (filterType === 'all' || filterType === 'liveevents' || filterType === 'live_events' || filterType === 'events') {
            details.liveEvents = await prisma.liveEventClaim.findMany({
                where: { userId },
                include: {
                    event: true
                }, 
                orderBy: { claimedAt: 'desc' }
            });
        }

        // 3. Fetch Coin Rush Claims
        if (filterType === 'all' || filterType === 'coinrushes' || filterType === 'coin_rushes' || filterType === 'coin_rush') {
            details.coinRushes = await prisma.coinRushClaim.findMany({
                where: { userId },
                include: {
                    event: true
                },
                orderBy: { claimedAt: 'desc' }
            });
        }

        // 4. Fetch Merchant Ad Claims
        if (filterType === 'all' || filterType === 'merchantads' || filterType === 'merchant_ads' || filterType === 'ads') {
            details.merchantAds = await prisma.merchantAdClaim.findMany({
                where: { userId },
                include: {
                    ad: true,
                    code: true
                },
                orderBy: { createdAt: 'desc' }
            });
        }

        return res.status(200).json({
            status: true,
            msg: "Rewards fetched successfully",
            details
        });
    } catch (error) {
        console.error("Error in getAllRewards:", error);
        return res.status(500).json({
            status: false,
            msg: error.message
        });
    }
};

/**
 * @Description Get all boxes log
 * @Route GET api/user/get-all-boxes
 * @Access Private
 */
export const getAllBoxes = async (req, res) => {
    const { id } = req.user;
    const { source } = req.query;
    try {
        const user = await prisma.user.findUnique({ where: { id: id } });
        if (!user) {
            return res.status(404).json({
                status: false,
                msg: "User not found"
            });
        }

        const whereClause = { userId: id };
        if (source) {
            whereClause.source = source;
        }

        const boxLogs = await prisma.boxCollectionLog.findMany({
            where: whereClause,
            orderBy: { createdAt: 'desc' }
        });

        res.status(200).json({
            status: true,
            msg: "Box history fetched successfully",
            currentLevel: user.level,
            totalGreenBoxes: user.green_boxes_count,
            totalGoldenBoxes: user.golden_boxes_count,
            totalPurpleBoxes: user.purple_boxes_count,
            history: boxLogs
        });
    } catch (error) {
        res.status(500).json({
            status: false,
            msg: error.message
        });
    }
};

/**
 * @Description Get User Live Event Claims
 * @Route GET api/user/live-events/claims
 * @Access Private
 */
export const getUserLiveEventClaims = async (req, res) => {
    const { id } = req.user;
    try {
        const user = await prisma.user.findUnique({ where: { id: id } });
        if (!user) {
            return res.status(404).json({
                status: false,
                msg: "User not found"
            });
        }

        const liveEventLogs = await prisma.liveEventClaim.findMany({
            where: { userId: id },
            include: { event: true },
            orderBy: { claimedAt: 'desc' }
        });

        res.status(200).json({
            status: true,
            msg: "Live event claims fetched successfully",
            history: liveEventLogs
        });
    } catch (error) {
        res.status(500).json({
            status: false,
            msg: error.message
        });
    }
};

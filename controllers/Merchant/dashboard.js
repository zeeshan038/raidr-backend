import { prisma } from "../../config/db.js"


/**
 * @Description Get All Compaigns
 * @Route GET /merchant/dashboard/all
 * @Access Private
 */
export const GetAllCampaigns = async (req, res) => {
    const { id } = req.merchant;
    const {search} = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const skip = (page - 1) * limit;
    try {
        const searchCondition = search ? {
            adTitle: {
                contains: search,
                mode: "insensitive"
            }
        } : {};

        const whereClause = {
            merchantId: id,
            ...searchCondition
        };

        const [campaigns, totalCount] = await Promise.all([
            prisma.merchantAds.findMany({
                where: whereClause,
                skip,
                take: limit,
                orderBy: {
                    createdAt: "desc"
                }
            }),
            prisma.merchantAds.count({
                where: whereClause
            })
        ]);

        return res.status(200).json({
            status: true,
            msg: "Active campaigns fetched successfully",
            campaigns,
            pagination: {
                page,
                limit,
                totalPages: Math.ceil(totalCount / limit),
                totalCount
            }
        });

    } catch (error) {
        return res.status(500).json({
            status: false,
            msg: error.message
        });
    }
}

/**
 * @Description Get My Active Compaings
 * @Route GET /merchant/dashboard/active-campaigns
 * @Access Private
 */
export const GetMyActiveCampaigns = async (req, res) => {
    const { id } = req.merchant;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const skip = (page - 1) * limit;
    try {
        const [campaigns, totalCount] = await Promise.all([
            prisma.merchantAds.findMany({
                where: {
                    merchantId: id,
                    isActive: true
                },
                skip,
                take: limit,
                orderBy: {
                    createdAt: "desc"
                }
            }),
            prisma.merchantAds.count({
                where: {
                    merchantId: id,
                    isActive: true
                }
            })
        ]);

        return res.status(200).json({
            status: true,
            msg: "Active campaigns fetched successfully",
            campaigns,
            pagination: {
                page,
                limit,
                totalPages: Math.ceil(totalCount / limit),
                totalCount
            }
        });

    } catch (error) {
        return res.status(500).json({
            status: false,
            msg: error.message
        });
    }
}


/**
 * @Description Get total Impression , boxes opened , reward claimed , total ads count 
 * @Route GET /merchant/dashboard/total-count
 * @Access Private
 */
export const GetDashboardTotalCount = async (req, res) => {
    const { id } = req.merchant;

    try {
        const stats = await prisma.merchantAds.aggregate({
            where: {
                merchantId: id
            },
            _sum: {
                impressions: true,
                boxOpens: true,
                rewardClaims: true
            }
        });

        const activeAdsCount = await prisma.merchantAds.count({
            where: {
                merchantId: id,
                isActive: true
            }
        });

        return res.status(200).json({
            status: true,
            msg: "Dashboard total counts fetched successfully",
            data: {
                totalImpressions: stats._sum.impressions || 0,
                totalBoxesOpened: stats._sum.boxOpens || 0,
                rewardsClaimed: stats._sum.rewardClaims || 0,
                totalAds: activeAdsCount
            }
        });
    } catch (error) {
        return res.status(500).json({
            status: false,
            msg: error.message
        });
    }
}


/**
 * @Description Impression Over Time
 * @Route GET /merchant/dashboard/impression-over-time
 * @Access Private
 */
export const GetImpressionOverTime = async (req, res) => {
    const { id } = req.merchant;
    const days = parseInt(req.query.days) || 7;

    try {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days + 1);
        startDate.setHours(0, 0, 0, 0);

        const impressions = await prisma.adImpression.findMany({
            where: {
                ad: {
                    merchantId: id
                },
                createdAt: {
                    gte: startDate
                }
            },
            select: {
                createdAt: true
            }
        });

        // Initialize date map for the last X days with 0 counts
        const dateMap = {};
        const dateList = [];
        for (let i = days - 1; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
            dateMap[label] = 0;
            dateList.push(label);
        }

        // Aggregate impressions by day
        impressions.forEach(imp => {
            const label = new Date(imp.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
            if (dateMap[label] !== undefined) {
                dateMap[label]++;
            }
        });

        const chartData = dateList.map(date => ({
            date,
            value: dateMap[date]
        }));

        return res.status(200).json({
            status: true,
            msg: "Impressions over time fetched successfully",
            data: chartData
        });
    } catch (error) {
        return res.status(500).json({
            status: false,
            msg: error.message
        });
    }
}

/**
 * @Description Get Reward Breakdown
 * @Route GET /merchant/dashboard/reward-breakdown
 * @Access Private
 */
export const GetRewardBreakdown = async (req, res) => {
    const { id } = req.merchant;

    try {
        const ads = await prisma.merchantAds.findMany({
            where: {
                merchantId: id
            },
            select: {
                mysteryBoxReward: true
            }
        });

        const totalAds = ads.length;

        if (totalAds === 0) {
            return res.status(200).json({
                status: true,
                msg: "Reward breakdown fetched successfully",
                data: []
            });
        }

        const counts = {};
        ads.forEach(ad => {
            const reward = ad.mysteryBoxReward || "No Reward";
            counts[reward] = (counts[reward] || 0) + 1;
        });

        const breakdown = Object.entries(counts).map(([name, count]) => ({
            name,
            count,
            percentage: parseFloat(((count / totalAds) * 100).toFixed(2))
        }));

        return res.status(200).json({
            status: true,
            msg: "Reward breakdown fetched successfully",
            data: breakdown
        });
    } catch (error) {
        return res.status(500).json({
            status: false,
            msg: error.message
        });
    }
}

/**
 * @Description Get Peak Activity Hours (Check-ins/Scans)
 * @Route GET /merchant/dashboard/peak-activity
 * @Access Private
 */
export const GetPeakActivityHours = async (req, res) => {
    const { id } = req.merchant;

    try {
        // Fetch Live Event Claims (scans) for this merchant
        const liveEventClaims = await prisma.liveEventClaim.findMany({
            where: {
                event: {
                    merchantId: id
                }
            },
            select: {
                claimedAt: true
            }
        });

        // Fetch Coin Rush Progress (scans/checkpoints) for this merchant
        const coinRushProgress = await prisma.coinRushProgress.findMany({
            where: {
                event: {
                    merchantId: id
                }
            },
            select: {
                completedAt: true
            }
        });

        // Combine all timestamps
        const allTimestamps = [
            ...liveEventClaims.map(c => c.claimedAt),
            ...coinRushProgress.map(p => p.completedAt)
        ];

        // Initialize 2-hour buckets from 08:00 to 22:00
        const hourBuckets = {
            "08:00": 0,
            "10:00": 0,
            "12:00": 0,
            "14:00": 0,
            "16:00": 0,
            "18:00": 0,
            "20:00": 0,
            "22:00": 0
        };

        // Categorize timestamps into buckets
        allTimestamps.forEach(date => {
            const hour = date.getHours(); // 0-23
            
            // Map hours to our specific buckets
            if (hour >= 6 && hour < 10) hourBuckets["08:00"]++;
            else if (hour >= 10 && hour < 12) hourBuckets["10:00"]++;
            else if (hour >= 12 && hour < 14) hourBuckets["12:00"]++;
            else if (hour >= 14 && hour < 16) hourBuckets["14:00"]++;
            else if (hour >= 16 && hour < 18) hourBuckets["16:00"]++;
            else if (hour >= 18 && hour < 20) hourBuckets["18:00"]++;
            else if (hour >= 20 && hour < 22) hourBuckets["20:00"]++;
            else if (hour >= 22 || hour < 6) hourBuckets["22:00"]++;
        });

        const chartData = Object.entries(hourBuckets).map(([time, scans]) => ({
            time,
            scans
        }));

        return res.status(200).json({
            status: true,
            msg: "Peak activity hours fetched successfully",
            data: chartData
        });

    } catch (error) {
        return res.status(500).json({
            status: false,
            msg: error.message
        });
    }
}


/**
 * @Description Get Event Stats (Live Raidr, Coin Rush, Completion, Checkpoints)
 * @Route GET /merchant/dashboard/event-stats
 * @Access Private
 */
export const GetEventStats = async (req, res) => {
    const { id } = req.merchant;

    try {
        const liveRaidrEventsCount = await prisma.liveEvent.count({
            where: {
                merchantId: id,
                status: "live"
            }
        });

        const liveCoinRushEventsCount = await prisma.coinRushEvent.count({
            where: {
                merchantId: id,
                status: "live"
            }
        });

        const activeCoinRushCheckpointsCount = await prisma.coinRushCheckpoint.count({
            where: {
                event: {
                    merchantId: id,
                    status: "live"
                }
            }
        });

        // Completion Rate Calculation
        // Total participants vs total claims across all events
        const totalLiveEventParticipants = await prisma.liveEventParticipant.count({
            where: { event: { merchantId: id } }
        });
        const totalLiveEventClaims = await prisma.liveEventClaim.count({
            where: { event: { merchantId: id } }
        });

        const totalCoinRushParticipants = await prisma.coinRushParticipant.count({
            where: { event: { merchantId: id } }
        });
        const totalCoinRushClaims = await prisma.coinRushClaim.count({
            where: { event: { merchantId: id } }
        });

        const totalParticipants = totalLiveEventParticipants + totalCoinRushParticipants;
        const totalClaims = totalLiveEventClaims + totalCoinRushClaims;

        let completionRate = 0;
        if (totalParticipants > 0) {
            completionRate = (totalClaims / totalParticipants) * 100;
        }

        return res.status(200).json({
            status: true,
            msg: "Event stats fetched successfully",
            data: {
                liveRaidrEvents: liveRaidrEventsCount,
                liveCoinRushEvents: liveCoinRushEventsCount,
                completionRate: parseFloat(completionRate.toFixed(1)),
                coinRushCheckpoints: activeCoinRushCheckpointsCount
            }
        });
    } catch (error) {
        return res.status(500).json({
            status: false,
            msg: error.message
        });
    }
}
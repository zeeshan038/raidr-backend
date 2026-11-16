import { prisma } from "../../config/db.js";

// Helper to format date as "MMM DD"
const formatDate = (date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// Helper function for percentage growth
const calculateGrowth = (current, previous) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return parseFloat((((current - previous) / previous) * 100).toFixed(1));
};

/**
 * @description Get dashboard metrics
 * @route GET /api/admin/dashboard/metrics
 * @access Private
 */
export const getDashboardMetrics = async (req, res) => {
    try {
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

        // 1. Total Merchants
        const totalMerchants = await prisma.merchant.count();
        const merchantsThisMonth = await prisma.merchant.count({
            where: { createdAt: { gte: thirtyDaysAgo } }
        });
        const merchantsLastMonth = await prisma.merchant.count({
            where: { createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } }
        });
        const merchantGrowth = calculateGrowth(merchantsThisMonth, merchantsLastMonth);

        // 2. Total Users
        const totalUsers = await prisma.user.count();
        const usersThisMonth = await prisma.user.count({
            where: { createdAt: { gte: thirtyDaysAgo } }
        });
        const usersLastMonth = await prisma.user.count({
            where: { createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } }
        });
        const userGrowth = calculateGrowth(usersThisMonth, usersLastMonth);

        // 3. Total Ads (MerchantAds)
        const totalAds = await prisma.merchantAds.count();
        const adsThisMonth = await prisma.merchantAds.count({
            where: { createdAt: { gte: thirtyDaysAgo } }
        });
        const adsLastMonth = await prisma.merchantAds.count({
            where: { createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } }
        });
        const adGrowth = calculateGrowth(adsThisMonth, adsLastMonth);

        // 4. Live Events (multiplayer)
        const totalEvents = await prisma.liveEvent.count();
        const eventsThisMonth = await prisma.liveEvent.count({
            where: { createdAt: { gte: thirtyDaysAgo } }
        });
        const eventsLastMonth = await prisma.liveEvent.count({
            where: { createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } }
        });
        const eventGrowth = calculateGrowth(eventsThisMonth, eventsLastMonth);

        // 5. Coin Rush
        const totalCoinRush = await prisma.coinRushEvent.count();
        const coinRushThisMonth = await prisma.coinRushEvent.count({
            where: { createdAt: { gte: thirtyDaysAgo } }
        });
        const coinRushLastMonth = await prisma.coinRushEvent.count({
            where: { createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } }
        });
        const coinRushGrowth = calculateGrowth(coinRushThisMonth, coinRushLastMonth);

        // 6. Credit purchase revenue (merchant credits)
        const purchasesThisMonth = await prisma.merchantCreditPurchase.aggregate({
            where: { createdAt: { gte: thirtyDaysAgo }, status: 'completed' },
            _sum: { priceUsd: true }
        });
        const purchasesLastMonth = await prisma.merchantCreditPurchase.aggregate({
            where: {
                createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo },
                status: 'completed'
            },
            _sum: { priceUsd: true }
        });
        const revenueThis = purchasesThisMonth._sum.priceUsd || 0;
        const revenueLast = purchasesLastMonth._sum.priceUsd || 0;
        const revenueGrowth = calculateGrowth(revenueThis, revenueLast);

        const liveMultiplayer = await prisma.liveEvent.count({ where: { status: 'live' } });
        const liveCoinRush = await prisma.coinRushEvent.count({ where: { status: 'live' } });

        return res.status(200).json({
            status: true,
            msg: "Dashboard metrics fetched successfully",
            data: {
                merchants: { total: totalMerchants, growth: merchantGrowth },
                users: { total: totalUsers, growth: userGrowth },
                ads: { total: totalAds, growth: adGrowth },
                events: { total: totalEvents, growth: eventGrowth, live: liveMultiplayer },
                coinRush: { total: totalCoinRush, growth: coinRushGrowth, live: liveCoinRush },
                revenue: {
                    total: parseFloat(revenueThis.toFixed(2)),
                    growth: revenueGrowth
                }
            }
        });
    } catch (error) {
        return res.status(500).json({
            status: false,
            msg: error.message
        });
    }
};

const resolveChartWindow = (req) => {
    const startParam = req.query.startDate;
    const endParam = req.query.endDate;
    let startDate;
    let endDate;

    if (startParam && endParam) {
        startDate = new Date(startParam);
        endDate = new Date(endParam);
        if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
            return { error: 'Invalid startDate or endDate' };
        }
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        if (endDate < startDate) {
            return { error: 'endDate must be on or after startDate' };
        }
        const spanDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
        if (spanDays > 90) {
            return { error: 'Date range cannot exceed 90 days' };
        }
    } else {
        const days = Math.min(parseInt(req.query.days, 10) || 7, 90);
        endDate = new Date();
        endDate.setHours(23, 59, 59, 999);
        startDate = new Date();
        startDate.setDate(startDate.getDate() - days + 1);
        startDate.setHours(0, 0, 0, 0);
    }

    return { startDate, endDate };
};

const buildDailyBuckets = (startDate, endDate) => {
    const buckets = [];
    const cursor = new Date(startDate);
    cursor.setHours(0, 0, 0, 0);
    const endDay = new Date(endDate);
    endDay.setHours(0, 0, 0, 0);
    while (cursor <= endDay) {
        buckets.push({ date: formatDate(cursor), count: 0, key: cursor.toISOString().slice(0, 10) });
        cursor.setDate(cursor.getDate() + 1);
    }
    return buckets;
};


/**
 * @description Get user growth chart
 * @route GET /api/admin/dashboard/user-growth
 * @access Private
 */
export const getUserGrowthChart = async (req, res) => {
    try {
        const window = resolveChartWindow(req);
        if (window.error) {
            return res.status(400).json({ status: false, msg: window.error });
        }
        const { startDate, endDate } = window;

        const usersInRange = await prisma.user.findMany({
            where: { createdAt: { gte: startDate, lte: endDate } },
            select: { createdAt: true }
        });

        const userGrowthData = buildDailyBuckets(startDate, endDate).map(({ date, count }) => ({ date, count }));

        usersInRange.forEach(u => {
            const dateStr = formatDate(u.createdAt);
            const dayObj = userGrowthData.find(d => d.date === dateStr);
            if (dayObj) dayObj.count += 1;
        });

        return res.status(200).json({
            status: true,
            msg: "User growth chart fetched successfully",
            data: userGrowthData
        });
    } catch (error) {
        return res.status(500).json({
            status: false,
            msg: error.message
        });
    }
};


/**
 * @description Get merchant growth chart
 * @route GET /api/admin/dashboard/merchant-growth
 * @access Private
 */
export const getMerchantGrowthChart = async (req, res) => {
    try {
        const window = resolveChartWindow(req);
        if (window.error) {
            return res.status(400).json({ status: false, msg: window.error });
        }
        const { startDate, endDate } = window;

        const merchantsInRange = await prisma.merchant.findMany({
            where: { createdAt: { gte: startDate, lte: endDate } },
            select: { createdAt: true }
        });

        const merchantGrowthData = buildDailyBuckets(startDate, endDate).map(({ date, count }) => ({ date, count }));

        merchantsInRange.forEach(m => {
            const dateStr = formatDate(m.createdAt);
            const dayObj = merchantGrowthData.find(d => d.date === dateStr);
            if (dayObj) dayObj.count += 1;
        });

        return res.status(200).json({
            status: true,
            msg: "Merchant growth chart fetched successfully",
            data: merchantGrowthData
        });
    } catch (error) {
        return res.status(500).json({
            status: false,
            msg: error.message
        });
    }
};

/**
 * @description Multiplayer created over time (normal raids + coin rush)
 * @route GET /api/admin/dashboard/charts/multiplayer
 */
export const getMultiplayerGrowthChart = async (req, res) => {
    try {
        const window = resolveChartWindow(req);
        if (window.error) {
            return res.status(400).json({ status: false, msg: window.error });
        }
        const { startDate, endDate } = window;

        const [liveEvents, coinRushEvents] = await Promise.all([
            prisma.liveEvent.findMany({
                where: { createdAt: { gte: startDate, lte: endDate } },
                select: { createdAt: true },
            }),
            prisma.coinRushEvent.findMany({
                where: { createdAt: { gte: startDate, lte: endDate } },
                select: { createdAt: true, eventType: true },
            }),
        ]);

        const buckets = buildDailyBuckets(startDate, endDate).map(({ date }) => ({
            date,
            normal: 0,
            coinRush: 0,
            indoor: 0,
            outdoor: 0,
            hybrid: 0,
        }));

        liveEvents.forEach((ev) => {
            const dateStr = formatDate(ev.createdAt);
            const dayObj = buckets.find((d) => d.date === dateStr);
            if (dayObj) dayObj.normal += 1;
        });

        coinRushEvents.forEach((ev) => {
            const dateStr = formatDate(ev.createdAt);
            const dayObj = buckets.find((d) => d.date === dateStr);
            if (!dayObj) return;
            dayObj.coinRush += 1;
            const type = (ev.eventType || "").toUpperCase();
            if (type === "GPS") dayObj.outdoor += 1;
            else if (type === "HYBRID") dayObj.hybrid += 1;
            else dayObj.indoor += 1;
        });

        return res.status(200).json({
            status: true,
            msg: "Multiplayer chart fetched successfully",
            data: buckets,
        });
    } catch (error) {
        return res.status(500).json({
            status: false,
            msg: error.message,
        });
    }
};

/**
 * @description Coin rush indoor/outdoor growth chart
 * @route GET /api/admin/dashboard/charts/coin-rush
 */
export const getCoinRushGrowthChart = async (req, res) => {
    try {
        const window = resolveChartWindow(req);
        if (window.error) {
            return res.status(400).json({ status: false, msg: window.error });
        }
        const { startDate, endDate } = window;

        const events = await prisma.coinRushEvent.findMany({
            where: { createdAt: { gte: startDate, lte: endDate } },
            select: { createdAt: true, eventType: true }
        });

        const buckets = buildDailyBuckets(startDate, endDate).map(({ date }) => ({
            date,
            indoor: 0,
            outdoor: 0,
            hybrid: 0
        }));

        events.forEach((ev) => {
            const dateStr = formatDate(ev.createdAt);
            const dayObj = buckets.find((d) => d.date === dateStr);
            if (!dayObj) return;
            const type = (ev.eventType || '').toUpperCase();
            if (type === 'GPS') dayObj.outdoor += 1;
            else if (type === 'HYBRID') dayObj.hybrid += 1;
            else dayObj.indoor += 1;
        });

        return res.status(200).json({
            status: true,
            msg: "Coin rush chart fetched successfully",
            data: buckets
        });
    } catch (error) {
        return res.status(500).json({
            status: false,
            msg: error.message
        });
    }
};

/**
 * @description Merchant credit purchase revenue over time
 * @route GET /api/admin/dashboard/charts/revenue
 */
export const getCreditPurchaseChart = async (req, res) => {
    try {
        const window = resolveChartWindow(req);
        if (window.error) {
            return res.status(400).json({ status: false, msg: window.error });
        }
        const { startDate, endDate } = window;

        const purchases = await prisma.merchantCreditPurchase.findMany({
            where: {
                createdAt: { gte: startDate, lte: endDate },
                status: 'completed'
            },
            select: { createdAt: true, priceUsd: true }
        });

        const buckets = buildDailyBuckets(startDate, endDate).map(({ date }) => ({
            date,
            count: 0
        }));

        purchases.forEach((p) => {
            const dateStr = formatDate(p.createdAt);
            const dayObj = buckets.find((d) => d.date === dateStr);
            if (dayObj) dayObj.count += Number(p.priceUsd) || 0;
        });

        return res.status(200).json({
            status: true,
            msg: "Revenue chart fetched successfully",
            data: buckets.map((b) => ({
                date: b.date,
                count: parseFloat(b.count.toFixed(2))
            }))
        });
    } catch (error) {
        return res.status(500).json({
            status: false,
            msg: error.message
        });
    }
};

export const getRecentMerchants = async (req, res) => {
    try {
        const merchants = await prisma.merchant.findMany({
            take: 5,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                businessName: true,
                category: true,
                credits: true,
                status: true,
            }
        });

        return res.status(200).json({
            status: true,
            msg: "Recent merchants fetched successfully",
            data: merchants
        });
    } catch (error) {
        return res.status(500).json({
            status: false,
            msg: error.message
        });
    }
};


/**
 * @description Get recent merchants
 * @route GET /api/admin/dashboard/recent-merchants
 * @access Private
 */
export const getUpcomingEvents = async (req, res) => {
    try {
        const events = await prisma.liveEvent.findMany({
            where: {
                startTime: { gte: new Date() }
            },
            take: 5,
            orderBy: { startTime: 'asc' },
            include: {
                merchant: {
                    select: {
                        businessName: true
                    }
                }
            }
        });

        return res.status(200).json({
            status: true,
            msg: "Upcoming events fetched successfully",
            data: events
        });
    } catch (error) {
        return res.status(500).json({
            status: false,
            msg: error.message
        });
    }
};

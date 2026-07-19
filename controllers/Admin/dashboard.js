import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Helper to format date as "MMM DD"
const formatDate = (date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// Helper function for percentage growth
const calculateGrowth = (current, previous) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return parseFloat((((current - previous) / previous) * 100).toFixed(1));
};

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

        // 4. Live Events
        const totalEvents = await prisma.liveEvent.count();
        const eventsThisMonth = await prisma.liveEvent.count({
            where: { createdAt: { gte: thirtyDaysAgo } }
        });
        const eventsLastMonth = await prisma.liveEvent.count({
            where: { createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } }
        });
        const eventGrowth = calculateGrowth(eventsThisMonth, eventsLastMonth);

        return res.status(200).json({
            status: true,
            msg: "Dashboard metrics fetched successfully",
            data: {
                merchants: { total: totalMerchants, growth: merchantGrowth },
                users: { total: totalUsers, growth: userGrowth },
                ads: { total: totalAds, growth: adGrowth },
                events: { total: totalEvents, growth: eventGrowth }
            }
        });
    } catch (error) {
        return res.status(500).json({
            status: false,
            msg: error.message
        });
    }
};

export const getUserGrowthChart = async (req, res) => {
    try {
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        const usersLast7Days = await prisma.user.findMany({
            where: { createdAt: { gte: sevenDaysAgo } },
            select: { createdAt: true }
        });

        const userGrowthData = [];
        for (let i = 0; i <= 6; i++) {
            const d = new Date(sevenDaysAgo.getTime() + i * 24 * 60 * 60 * 1000);
            userGrowthData.push({ date: formatDate(d), count: 0 });
        }

        usersLast7Days.forEach(u => {
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

export const getMerchantGrowthChart = async (req, res) => {
    try {
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        const merchantsLast7Days = await prisma.merchant.findMany({
            where: { createdAt: { gte: sevenDaysAgo } },
            select: { createdAt: true }
        });

        const merchantGrowthData = [];
        for (let i = 0; i <= 6; i++) {
            const d = new Date(sevenDaysAgo.getTime() + i * 24 * 60 * 60 * 1000);
            merchantGrowthData.push({ date: formatDate(d), count: 0 });
        }

        merchantsLast7Days.forEach(m => {
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

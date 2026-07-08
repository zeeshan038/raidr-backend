import prisma from "../prisma/client.js";


/**
 * @Description Get all store avatars
 * @Route GET /api/store/avatars?page&limit
 * @access Private
 */
export const getStoreAvatars = async (req, res) => {
    const userId = req.user.id;
    const { page = 1, limit = 10 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    try {
        const [avatars, total, userOwned, user] = await prisma.$transaction([
            prisma.store.findMany({
                skip,
                take: Number(limit),
                orderBy: { createdAt: 'desc' }
            }),
            prisma.store.count(),
            prisma.userOwnedAvatar.findMany({
                where: { userId },
                select: { storeId: true }
            }),
            prisma.user.findUnique({
                where: { id: userId },
                select: { raidrCoins: true }
            })
        ]);

        const ownedStoreIds = new Set(userOwned.map(o => o.storeId));

        const data = avatars.map(avatar => ({
            ...avatar,
            isOwned: ownedStoreIds.has(avatar.id)
        }));

        const hasNextPage = skip + avatars.length < total;

        return res.status(200).json({
            status: true,
            msg: 'Store avatars fetched successfully',
            coins: user.raidrCoins,
            data,
            pagination: {
                page: Number(page), 
                limit: Number(limit),
                total,
                hasNextPage
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
 * @Description Purchase Avatar
 * @Route POST /api/store/purchaseAvatar
 * @access Private
 */
export const purchaseAvatar = async (req, res) => {
    const userId = req.user.id;
    const { avatarId } = req.body;
    try {
        // 1. Fetch avatar and user in parallel
        const [avatar, user] = await Promise.all([
            prisma.store.findUnique({ where: { id: avatarId } }),
            prisma.user.findUnique({ where: { id: userId } })
        ]);

        if (!avatar) {
            return res.status(404).json({ status: false, msg: 'Avatar not found' });
        }

        if (!user) {
            return res.status(404).json({ status: false, msg: 'User not found' });
        }

        // 2. Check balance BEFORE doing anything else (using raidrCoins)
        if (user.raidrCoins < avatar.price) {
            return res.status(400).json({
                status: false,
                msg: 'Insufficient balance'
            });
        }

        // 3. Check if user already owns this avatar
        const alreadyOwned = await prisma.userOwnedAvatar.findUnique({
            where: { userId_storeId: { userId, storeId: avatarId } }
        });

        if (alreadyOwned) {
            return res.status(409).json({
                status: false,
                msg: 'You already own this avatar'
            });
        }

        // 4. Atomically deduct balance + record ownership
        const [, ownedAvatar] = await prisma.$transaction([
            prisma.user.update({
                where: { id: userId },
                data: { raidrCoins: { decrement: avatar.price } }
            }),
            prisma.userOwnedAvatar.create({
                data: { userId, storeId: avatarId }
            })
        ]);

        return res.status(200).json({
            status: true,
            msg: 'Avatar purchased successfully',
            data: { avatar, ownedAvatar }
        });

    } catch (error) {
        return res.status(500).json({
            status: false,
            msg: error.message
        });
    }
};


/**
 * @Description Get all avatars owned by the logged-in user
 * @Route GET /api/store/myAvatars
 * @access Private
 */
export const getMyAvatars = async (req, res) => {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    try {
        const owned = await prisma.userOwnedAvatar.findMany({
            where: { userId },
            include: { store: true },
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit
        });

        return res.status(200).json({
            status: true,
            msg: 'Owned avatars fetched successfully',
            data: owned.map(o => o.store),
            pagination: {
                page: page,
                limit: limit,
                hasNextPage: owned.length === limit
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
 * @Description Purchase Raid coins
 * @Route POST /api/store/purchase-coins
 * @access Private
 */
export const PurchaseCoins = async (req, res) => {
    const userId = req.user.id;
    const { coinsAmount, priceUsd, transactionId } = req.body;

    if (!coinsAmount || typeof coinsAmount !== 'number' || coinsAmount <= 0) {
        return res.status(400).json({
            status: false,
            msg: 'Invalid coins amount'
        });
    }

    if (priceUsd === undefined || typeof priceUsd !== 'number' || priceUsd < 0) {
        return res.status(400).json({
            status: false,
            msg: 'Invalid price'
        });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!user) {
            return res.status(404).json({
                status: false,
                msg: 'User not found'
            });
        }

        // Atomically update user's coins and create a purchase history record
        const [updatedUser, purchaseHistory] = await prisma.$transaction([
            prisma.user.update({
                where: { id: userId },
                data: { raidrCoins: { increment: coinsAmount } }
            }),
            prisma.raidPurchaseHistory.create({
                data: {
                    userId,
                    coinsAmount,
                    priceUsd,
                    transactionId,
                    status: 'completed'
                }
            })
        ]);

        return res.status(200).json({
            status: true,
            msg: 'Coins purchased successfully',
            data: {
                raidrCoins: updatedUser.raidrCoins,
                purchaseHistory
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
 * @Description Get Purchase History
 * @Route GET /api/store/transaction-history
 * @access Private
 */
export const getTransactionHistory = async (req, res) => {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    try {
        const [transactions, total] = await prisma.$transaction([
            prisma.raidPurchaseHistory.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit
            }),
            prisma.raidPurchaseHistory.count({
                where: { userId }
            })
        ]);

        const hasNextPage = skip + transactions.length < total;

        return res.status(200).json({
            status: true,
            msg: 'Transaction history fetched successfully',
            data: transactions,
            pagination: {
                page,
                limit,
                total,
                hasNextPage
            }
        });

    } catch (error) {
        return res.status(500).json({
            status: false,
            msg: error.message
        });
    }
};
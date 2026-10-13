import prisma from "../prisma/client.js";


/**
 * @Description Get all store items (avatars and guard products)
 * @Route GET /api/store/all-items
 * @access Private
 */
export const getStoreAvatars = async (req, res) => {
    const userId = req.user.id;
    const { page = 1, limit = 10, itemType } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where = {
        isStoreActive: true,
        ...(itemType ? { itemType: String(itemType).toUpperCase() } : {}),
    };

    try {
        const [items, total, userOwned, user] = await prisma.$transaction([
            prisma.store.findMany({
                where,
                skip,
                take: Number(limit),
                orderBy: { createdAt: 'desc' }
            }),
            prisma.store.count({ where }),
            prisma.userOwnedAvatar.findMany({
                where: { userId },
                select: { storeId: true }
            }),
            prisma.user.findUnique({
                where: { id: userId },
                select: { raidrCoins: true, spGuardInventory: true }
            })
        ]);

        const ownedStoreIds = new Set(userOwned.map(o => o.storeId));

        const data = items.map((item) => ({
            ...item,
            isOwned: item.itemType === 'GUARD' ? false : ownedStoreIds.has(item.id),
        }));

        const hasNextPage = skip + items.length < total;

        return res.status(200).json({
            status: true,
            msg: 'Store items fetched successfully',
            coins: user.raidrCoins,
            spGuardInventory: user.spGuardInventory ?? 0,
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
 * @Description Purchase a store item (avatar or guard product)
 * @Route POST /api/store/purchase
 * @access Private
 */
export const purchaseAvatar = async (req, res) => {
    const userId = req.user.id;
    const storeItemId = req.body.storeItemId || req.body.avatarId;
    const purchaseQuantity = Math.max(1, parseInt(req.body.quantity, 10) || 1);

    if (!storeItemId) {
        return res.status(400).json({ status: false, msg: 'storeItemId or avatarId is required' });
    }

    try {
        const [item, user] = await Promise.all([
            prisma.store.findUnique({ where: { id: storeItemId } }),
            prisma.user.findUnique({ where: { id: userId } })
        ]);

        if (!item || !item.isStoreActive) {
            return res.status(404).json({ status: false, msg: 'Store item not found' });
        }

        if (!user) {
            return res.status(404).json({ status: false, msg: 'User not found' });
        }

        const itemType = item.itemType || 'AVATAR';

        if (itemType === 'GUARD') {
            const totalCost = item.price * purchaseQuantity;
            if (user.raidrCoins < totalCost) {
                return res.status(400).json({ status: false, msg: 'Insufficient balance' });
            }

            const guardsAdded = item.guardsPerPurchase * purchaseQuantity;
            const updatedUser = await prisma.user.update({
                where: { id: userId },
                data: {
                    raidrCoins: { decrement: totalCost },
                    spGuardInventory: { increment: guardsAdded },
                },
                select: { raidrCoins: true, spGuardInventory: true },
            });

            return res.status(200).json({
                status: true,
                msg: 'Guards purchased successfully',
                data: {
                    item,
                    quantity: purchaseQuantity,
                    guardsAdded,
                    spGuardInventory: updatedUser.spGuardInventory,
                    raidrCoins: updatedUser.raidrCoins,
                },
            });
        }

        if (user.raidrCoins < item.price) {
            return res.status(400).json({ status: false, msg: 'Insufficient balance' });
        }

        const alreadyOwned = await prisma.userOwnedAvatar.findUnique({
            where: { userId_storeId: { userId, storeId: storeItemId } }
        });

        if (alreadyOwned) {
            return res.status(409).json({ status: false, msg: 'You already own this avatar' });
        }

        const [, ownedAvatar] = await prisma.$transaction([
            prisma.user.update({
                where: { id: userId },
                data: { raidrCoins: { decrement: item.price } }
            }),
            prisma.userOwnedAvatar.create({
                data: { userId, storeId: storeItemId }
            })
        ]);

        return res.status(200).json({
            status: true,
            msg: 'Avatar purchased successfully',
            data: { item, ownedAvatar }
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

        const avatarsList = owned.map(o => o.store);

        if (page === 1) {
            avatarsList.unshift({
                id: "424", // Empty string matches selectedAvatarId default
                name: "Default Avatar",
                frontUrl: "https://hel1.your-objectstorage.com/raidr-assets/avatars/1_front.png",
                backUrl: "https://hel1.your-objectstorage.com/raidr-assets/avatars/1_back.png",
                price: 0,
                isNew: false,
                isFeatured: false,
            });
        }

        return res.status(200).json({
            status: true,
            msg: 'Owned avatars fetched successfully',
            data: avatarsList,
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
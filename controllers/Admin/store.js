import prisma from "../../prisma/client.js";
import {
    CreateAvatarSchema,
    CreateGuardProductSchema,
    UpdateAvatarSchema,
} from "../../schema/Admin/Store.js";

const STORE_ITEM_TYPES = {
    AVATAR: "AVATAR",
    GUARD: "GUARD",
};


/**
 * @Description Create Avatar for store
 * @Route POST /api/admin/store/create-avatar
 * @Access Private (Admin Only)
 */
export const CreateAvatar = async (req, res) => {
    const paylaod = req.body

    const result = CreateAvatarSchema(paylaod);
    if (result.error) {
        return res.status(400).json({
            status: false,
            msg: result.error.message
        })
    }
    try {
       const newAvatar = await prisma.store.create({
           data: {
               name: paylaod.name,
               itemType: STORE_ITEM_TYPES.AVATAR,
               frontUrl: paylaod.frontUrl,
               backUrl: paylaod.backUrl,
               price: paylaod.price,
               isFeatured: paylaod.isFeatured,
               isNew: paylaod.isNew,
               spCaptureTimeSec: paylaod.spCaptureTimeSec,
               spShieldDurationMin: paylaod.spShieldDurationMin,
           }
       })

       return res.status(200).json({
            status: true,
            msg: "Avatar created successfully",
            data: newAvatar
       })
    } catch (error) {
        res.status(500).json({
            status: false,
            msg: error.message
        })
    }
}

/**
 * @Description Create Guard product for RAIDR Store (Single Player)
 * @Route POST /api/admin/store/create-guard
 * @Access Private (Admin Only)
 */
export const CreateGuardProduct = async (req, res) => {
    const result = CreateGuardProductSchema(req.body);
    if (result.error) {
        return res.status(400).json({ status: false, msg: result.error.message });
    }

    const payload = result.value;

    try {
        const item = await prisma.store.create({
            data: {
                name: payload.name,
                itemType: STORE_ITEM_TYPES.GUARD,
                frontUrl: payload.frontUrl,
                backUrl: payload.backUrl || payload.frontUrl,
                price: payload.price,
                guardsPerPurchase: payload.guardsPerPurchase,
                isFeatured: payload.isFeatured,
                isNew: payload.isNew,
                isStoreActive: payload.isStoreActive,
            },
        });

        return res.status(201).json({
            status: true,
            msg: "Guard product created successfully",
            data: item,
        });
    } catch (error) {
        return res.status(500).json({ status: false, msg: error.message });
    }
};

/**
 * @Description Get All Avatars from store
 * @Route POST /api/admin/store/get-all
 * @Access Private (Admin Only)
 */
export const getAllStoreItems = async(req ,res)=>{
    const search = req.query.search || ''
    const itemType = req.query.itemType
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 10
    const skip = (page - 1) * limit
    try {
        const whereClause = {
            ...(search
                ? {
                    name: {
                        contains: search,
                        mode: 'insensitive',
                    },
                }
                : {}),
            ...(itemType ? { itemType: String(itemType).toUpperCase() } : {}),
        };

        const storeItems = await prisma.store.findMany({
            where: whereClause,
            take: limit,
            skip,
            orderBy: { createdAt: "desc" },
        });

        const totalItems = await prisma.store.count({ where: whereClause });
        const totalPages = Math.ceil(totalItems / limit);

        return res.status(200).json({
            status: true,
            msg: "Store items fetched successfully",
            data: storeItems,
            pagination: {
                totalItems,
                totalPages,
                currentPage: page,
                limit,
            },
        });
    } catch (error) {
        res.status(500).json({
            status: false,
            msg: error.message
        })
    }
}


/**
 * @Description Update Avatar in store
 * @Route PUT /api/admin/store/update/:id
 * @Access Private (Admin Only)
 */
export const updateStoreItem = async (req, res) => {
    const { id } = req.params;
    const payload = req.body;

    const result = UpdateAvatarSchema(payload);
    if (result.error) {
        return res.status(400).json({
            status: false,
            msg: result.error.message
        });
    }

    try {
        const existing = await prisma.store.findUnique({ where: { id } });
        if (!existing) {
            return res.status(404).json({ status: false, msg: "Store item not found" });
        }

        const updatedAvatar = await prisma.store.update({
            where: { id },
            data: {
                name: payload.name !== undefined ? payload.name : existing.name,
                frontUrl: payload.frontUrl !== undefined ? payload.frontUrl : existing.frontUrl,
                backUrl: payload.backUrl !== undefined ? payload.backUrl : existing.backUrl,
                price: payload.price !== undefined ? payload.price : existing.price,
                isFeatured: payload.isFeatured !== undefined ? payload.isFeatured : existing.isFeatured,
                isNew: payload.isNew !== undefined ? payload.isNew : existing.isNew,
                spCaptureTimeSec: payload.spCaptureTimeSec !== undefined ? payload.spCaptureTimeSec : existing.spCaptureTimeSec,
                spShieldDurationMin: payload.spShieldDurationMin !== undefined ? payload.spShieldDurationMin : existing.spShieldDurationMin,
                guardsPerPurchase: payload.guardsPerPurchase !== undefined ? payload.guardsPerPurchase : existing.guardsPerPurchase,
                isStoreActive: payload.isStoreActive !== undefined ? payload.isStoreActive : existing.isStoreActive,
            }
        });

        return res.status(200).json({
            status: true,
            msg: "Store item updated successfully",
            data: updatedAvatar
        });
    } catch (error) {
        res.status(500).json({
            status: false,
            msg: error.message
        });
    }
}

/**
 * @Description Delete Avatar from store
 * @Route DELETE /api/admin/store/delete/:id
 * @Access Private (Admin Only)
 */
export const deleteStoreItem = async (req, res) => {
    const { id } = req.params;

    try {
        const existing = await prisma.store.findUnique({ where: { id } });
        if (!existing) {
            return res.status(404).json({ status: false, msg: "Avatar not found" });
        }

        await prisma.store.delete({
            where: { id }
        });

        return res.status(200).json({
            status: true,
            msg: "Avatar deleted successfully"
        });
    } catch (error) {
        res.status(500).json({
            status: false,
            msg: error.message
        });
    }
}
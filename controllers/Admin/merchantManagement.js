import { prisma } from "../../config/db.js";

/**
 * @Description Get All Merchants
 * @Route GET api/admin/merchants
 * @Access Private
 */
export const getAllMerchants = async (req, res) => {
    try {
        const merchants = await prisma.merchant.findMany({
            select: {
                id: true,
                name: true,
                email: true,
                businessName: true,
                category: true,
                phone: true,
                status: true,
                photoUrl: true,
                credits: true
            }
        });

        return res.status(200).json({
            status: true,
            msg: "Merchants fetched successfully",
            merchants
        });
    } catch (error) {
        return res.status(500).json({
            status: false,
            msg: error.message
        });
    }
}

/**
 * @Description Get Single Merchant
 * @Route GET api/admin/merchants/:id
 * @Access Private
 */
export const getMerchantById = async (req, res) => {
    const { id } = req.params;
    
    if (!id) {
        return res.status(400).json({ status: false, msg: "Merchant ID is required" });
    }

    try {
        const merchant = await prisma.merchant.findUnique({
            where: { id: id },
            select: {
                id: true,
                name: true,
                email: true,
                businessName: true,
                category: true,
                phone: true,
                status: true,
                photoUrl: true,
                address: true,
                credits: true,
                defaultRadiusMeter: true
            }
        });

        if (!merchant) {
            return res.status(404).json({ status: false, msg: "Merchant not found" });
        }

        return res.status(200).json({
            status: true,
            msg: "Merchant fetched successfully",
            merchant
        });
    } catch (error) {
        return res.status(500).json({
            status: false,
            msg: error.message
        });
    }
}

/**
 * @Description Update Merchant
 * @Route PUT api/admin/merchants/update/:id
 * @Access Private
 */
export const updateMerchantById = async (req, res) => {
    const { id } = req.params;
    const payload = req.body;

    if (!id) {
        return res.status(400).json({ status: false, msg: "Merchant ID is required" });
    }

    try {
        const existingMerchant = await prisma.merchant.findUnique({ where: { id: id } });
        if (!existingMerchant) {
            return res.status(404).json({ status: false, msg: "Merchant not found" });
        }

        // Avoid letting admin update password or id directly
        delete payload.password;
        delete payload.id;

        const updatedMerchant = await prisma.merchant.update({
            where: { id: id },
            data: payload
        });

        const merchantResponse = { ...updatedMerchant, _id: updatedMerchant.id };
        delete merchantResponse.password;

        return res.status(200).json({
            status: true,
            msg: "Merchant updated successfully",
            merchant: merchantResponse
        });
    } catch (error) {
        return res.status(500).json({
            status: false,
            msg: error.message
        });
    }
}

/**
 * @Description Delete Merchant
 * @Route DELETE api/admin/merchants/delete/:id
 * @Access Private
 */
export const deleteMerchantById = async (req, res) => {
    const { id } = req.params;

    if (!id) {
        return res.status(400).json({
            status: false,
            msg: "Merchant ID is required"
        });
    }

    try {
        const existingMerchant = await prisma.merchant.findUnique({ where: { id: id } });
        if (!existingMerchant) {
            return res.status(404).json({
                status: false,
                msg: "Merchant not found"
            });
        }
        
        // Delete related records that don't have onDelete: Cascade in Prisma schema
        // MerchantAds relation on Merchant is not CASCADE
        await prisma.merchantAds.deleteMany({ where: { merchantId: id } });

        const merchant = await prisma.merchant.delete({ where: { id: id } });

        const merchantResponse = { ...merchant, _id: merchant.id };
        delete merchantResponse.password;

        return res.status(200).json({
            status: true,
            msg: "Merchant deleted successfully",
            merchant: merchantResponse
        });
    } catch (error) {
        return res.status(500).json({
            status: false,
            msg: error.message
        });
    }
}

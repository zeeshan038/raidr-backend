import { prisma } from "../../config/db.js";
import crypto from "crypto";

//Schema
import { MerchantAdsCreateSchema, MerchantAdsUpdateSchema } from "../../schema/Merchant/Ads.js";


/**
 * @Description Create a new campaign (ad)
 * @Route POST /api/merchant/ads/create
 * @Access Private
 */
export const createCampaign = async (req, res) => {
    const { id } = req.merchant;
    const payload = req.body;

    const result = MerchantAdsCreateSchema(payload);
    if (result.error) {
        return res.status(400).json({
            status: false,
            msg: result.error.message
        });
    }

    try {
        const merchant = await prisma.merchant.findUnique({
            where: { id: id }
        });

        if (!merchant) {
            return res.status(404).json({ status: false, msg: "Merchant not found" });
        }

        const stockLimit = parseInt(payload.stockLimit) || 0;

        const newAd = await prisma.merchantAds.create({
            data: {
                adTitle: payload.adTitle,
                adCategory: payload.adCategory,
                categoryName: payload.categoryName,
                address: payload.address,
                approvalStatus: "approved",
                city: payload.city || "Unknown",
                country: payload.country || "Unknown",
                descriptionText: payload.descriptionText || "",
                imageUrl: payload.adImage || "",
                logoUrl: payload.logoUrl || "",
                isActive: payload.isActive !== false,
                latitude: parseFloat(payload.latitude) || 0.0,
                longitude: parseFloat(payload.longitude) || 0.0,
                merchantId: id,
                merchantName: merchant.name || "Unknown Merchant",
                radius: parseInt(payload.radius) || 0,
                impressions: parseInt(payload.impressions) || 0,
                boxOpens: parseInt(payload.boxOpens) || 0,
                rewardClaims: parseInt(payload.rewardClaims) || 0,
                mysteryBoxReward: payload.mysteryBoxReward,
                stockLimit: stockLimit,
            }
        });

        // Generate unique codes for the stock limit
        if (stockLimit > 0) {
            const codeData = Array.from({ length: stockLimit }).map(() => ({
                adId: newAd.id,
                code: crypto.randomBytes(4).toString('hex').toUpperCase(),
            }));
            await prisma.merchantAdCode.createMany({
                data: codeData
            });
        }

        return res.status(201).json({
            status: true,
            msg: "Campaign created successfully",
            ad: newAd
        });
    } catch (err) {
        return res.status(500).json({
            status: false,
            msg: err.message
        });
    }
};


/**
 * @Description Get Compaigns 
 * @Route GET /api/merchant/ads/get-all-campaigns?search=&page=&limit=&adCategory=
 * @Access Private
 */
export const getCampaigns = async (req, res) => {
    const { id } = req.merchant;
    const { search, adCategory } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    try {
        let matchQuery = {
            merchantId: id,
        }

        if (search) {
            matchQuery.OR = [
                { adTitle: { contains: search, mode: "insensitive" } },
                { descriptionText: { contains: search, mode: "insensitive" } },
            ]
        }
        if (adCategory) {
            matchQuery.adCategory = adCategory;
        }

        const [totalCount, data] = await Promise.all([
            prisma.merchantAds.count({ where: matchQuery }),
            prisma.merchantAds.findMany({
                where: matchQuery,
                take: limit,
                skip: skip,
                orderBy: {
                    createdAt: "desc",
                }
            })
        ]);

        return res.status(200).json({
            status: true,
            data,
            pagination: {
                totalCount,
                totalPages: Math.ceil(totalCount / limit),
                currentPage: page
            }
        });
    } catch (err) {
        return res.status(500).json({
            status: false,
            msg: err.message
        });
    }
};


/**
 * @Description Get Compaign by Id 
 * @Route GET /api/ads/campaign/:id
 * @Access Private
 */
export const getCampaignById = async (req, res) => {
    const { id } = req.merchant;
    const { id: campaignId } = req.params;
    const { search } = req.query;
    
    try {
        let adCodeFilter = undefined;
        if (search) {
            adCodeFilter = {
                OR: [
                    { code: { contains: search, mode: "insensitive" } },
                    { claim: { user: { name: { contains: search, mode: "insensitive" } } } }, 
                    { claim: { user: { email: { contains: search, mode: "insensitive" } } } } 
                ]
            };
        }

        const ad = await prisma.merchantAds.findFirst({
            where: { id: campaignId, merchantId: id },
            include: {
                adCodes: {
                    where: adCodeFilter,
                    include: {
                        claim: {
                            include: {
                                user: {
                                    select: {
                                        id: true,
                                        name: true,
                                        email: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        if (!ad) {
            return res.status(404).json({
                status: false,
                msg: "Campaign not found"
            });
        }
        return res.status(200).json({
            status: true,
            ad
        });

    } catch (err) {
        return res.status(500).json({
            status: false,
            msg: err.message
        });
    }
};


/**
 * @Description Update Compaign 
 * @Route PUT /api/ads/update-campaign/:id
 * @Access Private
 */
export const updateCampaign = async (req, res) => {
    const { id } = req.params;
    const { id: merchantId } = req.merchant;
    const payload = req.body;
    const result = MerchantAdsUpdateSchema(payload);
    if (result.error) {
        return res.status(400).json({
            status: false,
            msg: result.error.message
        });
    }

    try {
        const ad = await prisma.merchantAds.findFirst({
            where: { id, merchantId }
        });

        if (!ad) {
            return res.status(404).json({ status: false, msg: "Campaign not found or unauthorized" });
        }

        const updatedAd = await prisma.merchantAds.update({
            where: { id },
            data: {
                adTitle: payload.adTitle || ad.adTitle,
                adCategory: payload.adCategory || ad.adCategory,
                categoryName: payload.categoryName || ad.categoryName,
                address: payload.address || ad.address,
                city: payload.city || ad.city,
                country: payload.country || ad.country,
                descriptionText: payload.descriptionText !== undefined ? payload.descriptionText : ad.descriptionText,
                imageUrl: payload.adImage || ad.imageUrl,
                logoUrl: payload.logoUrl || ad.logoUrl,
                isActive: payload.isActive !== undefined ? payload.isActive : ad.isActive,
                latitude: payload.latitude !== undefined ? parseFloat(payload.latitude) : ad.latitude,
                longitude: payload.longitude !== undefined ? parseFloat(payload.longitude) : ad.longitude,
                radius: payload.radius !== undefined ? parseInt(payload.radius) : ad.radius,
                mysteryBoxReward: payload.mysteryBoxReward || ad.mysteryBoxReward,
                stockLimit: payload.stockLimit !== undefined ? parseInt(payload.stockLimit) : ad.stockLimit,
            }
        });

        return res.status(200).json({
            status: true,
            msg: "Campaign updated successfully",
            ad: updatedAd
        });
    } catch (err) {
        return res.status(500).json({
            status: false,
            msg: err.message
        });
    }
};


/**
 * @Description Delete Compaign 
 * @Route DELETE /api/merchant/ads/:id
 * @Access Private
 */
export const deleteCampaign = async (req, res) => {
    const { id: merchantId } = req.merchant;
    const { id } = req.params;

    try {
        const ad = await prisma.merchantAds.findFirst({
            where: { id, merchantId }
        });

        if (!ad) {
            return res.status(404).json({
                status: false,
                msg: "Campaign not found or unauthorized"
            });
        }

        await prisma.merchantAds.delete({
            where: { id }
        });

        return res.status(200).json({
            status: true,
            msg: "Campaign deleted successfully"
        });
    } catch (err) {

        return res.status(500).json({
            status: false,
            msg: err.message
        });
    }
};


/**
 * @Description Toggle Campaign Active Status
 * @Route PATCH /api/ad/adId/:adId
 * @Access Private
 */
export const toggleCampaignStatus = async (req, res) => {
    const { id } = req.merchant
    const { id: adId } = req.params;
    const { isActive } = req.body;

    try {


        const ad = await prisma.merchantAds.findFirst({
            where: { id: adId, merchantId: id }
        });

        if (!ad) {
            return res.status(404).json({
                status: false,
                msg: "Campaign not found or unauthorized"
            });
        }

        const updatedAd = await prisma.merchantAds.update({
            where: { id: adId },
            data: { isActive }
        });

        return res.status(200).json({
             status: true,
              msg: "Campaign status toggled successfully",
               ad: updatedAd });
    } catch (err) {
        return res.status(500).json({ 
            status: false, 
            msg: err.message 
        });
    }
};



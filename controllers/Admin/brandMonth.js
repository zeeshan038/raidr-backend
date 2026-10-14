import { prisma } from "../../config/db.js";
import {
  CreateBrandMonthSchema,
  UpdateBrandMonthSchema,
} from "../../schema/Admin/BrandMonth.js";
import { BRAND_MONTH_REWARD_TYPE } from "../../utils/brandMonth.js";

const mapCampaignResponse = (row) => ({ ...row });

/**
 * @Description Create a Brand Month campaign (XP target, inventory, reward, optional theme)
 * @Route POST /api/admin/brand-months
 * @Access Private (Admin)
 */
export const createBrandMonthCampaign = async (req, res) => {
  const result = CreateBrandMonthSchema(req.body);
  if (result.error) {
    return res.status(400).json({ status: false, msg: result.error.message });
  }
  const value = result.value;

  try {
    if (value.commercialVoucherId) {
      const voucher = await prisma.commercialVoucher.findUnique({
        where: { id: value.commercialVoucherId },
      });
      if (!voucher) {
        return res.status(400).json({ status: false, msg: "Commercial voucher not found" });
      }
    }

    if (value.sponsoredThemeId) {
      const theme = await prisma.sponsoredTheme.findUnique({
        where: { id: value.sponsoredThemeId },
      });
      if (!theme) {
        return res.status(400).json({ status: false, msg: "Sponsored theme not found" });
      }
    }

    const inventoryTotal = value.inventoryTotal;
    const campaign = await prisma.brandMonthCampaign.create({
      data: {
        name: value.name,
        description: value.description ?? null,
        brandLogoUrl: value.brandLogoUrl ?? null,
        startDate: new Date(value.startDate),
        endDate: new Date(value.endDate),
        xpTarget: value.xpTarget,
        inventoryTotal,
        inventoryRemaining: inventoryTotal,
        rewardType: value.rewardType ?? BRAND_MONTH_REWARD_TYPE.INLINE,
        commercialVoucherId: value.commercialVoucherId ?? null,
        rewardTitle: value.rewardTitle ?? null,
        rewardSponsorName: value.rewardSponsorName ?? null,
        rewardDescription: value.rewardDescription ?? null,
        rewardImageUrl: value.rewardImageUrl ?? null,
        rewardRedemptionCode: value.rewardRedemptionCode ?? null,
        sponsoredThemeId: value.sponsoredThemeId ?? null,
        isActive: value.isActive !== undefined ? value.isActive : true,
      },
      include: { commercialVoucher: true, sponsoredTheme: true },
    });

    res.status(201).json({
      status: true,
      msg: "Brand Month campaign created",
      data: mapCampaignResponse(campaign),
    });
  } catch (error) {
    res.status(500).json({ status: false, msg: error.message });
  }
};

/**
 * @Description List Brand Month campaigns
 * @Route GET /api/admin/brand-months
 * @Access Private (Admin)
 */
export const listBrandMonthCampaigns = async (req, res) => {
  try {
    const campaigns = await prisma.brandMonthCampaign.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        commercialVoucher: true,
        sponsoredTheme: true,
        _count: { select: { progress: true } },
      },
    });

    res.status(200).json({
      status: true,
      data: campaigns.map(mapCampaignResponse),
    });
  } catch (error) {
    res.status(500).json({ status: false, msg: error.message });
  }
};

/**
 * @Description Get one Brand Month campaign
 * @Route GET /api/admin/brand-months/:id
 * @Access Private (Admin)
 */
export const getBrandMonthCampaignById = async (req, res) => {
  try {
    const campaign = await prisma.brandMonthCampaign.findUnique({
      where: { id: req.params.id },
      include: {
        commercialVoucher: true,
        sponsoredTheme: true,
        _count: { select: { progress: true } },
      },
    });

    if (!campaign) {
      return res.status(404).json({ status: false, msg: "Campaign not found" });
    }

    res.status(200).json({ status: true, data: mapCampaignResponse(campaign) });
  } catch (error) {
    res.status(500).json({ status: false, msg: error.message });
  }
};

/**
 * @Description Update Brand Month campaign
 * @Route PUT /api/admin/brand-months/:id
 * @Access Private (Admin)
 */
export const updateBrandMonthCampaign = async (req, res) => {
  const result = UpdateBrandMonthSchema(req.body);
  if (result.error) {
    return res.status(400).json({ status: false, msg: result.error.message });
  }
  const value = result.value;

  try {
    const existing = await prisma.brandMonthCampaign.findUnique({
      where: { id: req.params.id },
    });
    if (!existing) {
      return res.status(404).json({ status: false, msg: "Campaign not found" });
    }

    if (value.commercialVoucherId) {
      const voucher = await prisma.commercialVoucher.findUnique({
        where: { id: value.commercialVoucherId },
      });
      if (!voucher) {
        return res.status(400).json({ status: false, msg: "Commercial voucher not found" });
      }
    }

    const data = {};
    if (value.name !== undefined) data.name = value.name;
    if (value.description !== undefined) data.description = value.description;
    if (value.brandLogoUrl !== undefined) data.brandLogoUrl = value.brandLogoUrl;
    if (value.startDate !== undefined) data.startDate = new Date(value.startDate);
    if (value.endDate !== undefined) data.endDate = new Date(value.endDate);
    if (value.xpTarget !== undefined) data.xpTarget = value.xpTarget;
    if (value.inventoryTotal !== undefined) {
      data.inventoryTotal = value.inventoryTotal;
      const claimed = existing.inventoryTotal - existing.inventoryRemaining;
      if (value.inventoryRemaining === undefined) {
        data.inventoryRemaining = Math.max(0, value.inventoryTotal - claimed);
      }
    }
    if (value.inventoryRemaining !== undefined) {
      data.inventoryRemaining = value.inventoryRemaining;
    }
    if (value.rewardType !== undefined) data.rewardType = value.rewardType;
    if (value.commercialVoucherId !== undefined) {
      data.commercialVoucherId = value.commercialVoucherId;
    }
    if (value.rewardTitle !== undefined) data.rewardTitle = value.rewardTitle;
    if (value.rewardSponsorName !== undefined) {
      data.rewardSponsorName = value.rewardSponsorName;
    }
    if (value.rewardDescription !== undefined) {
      data.rewardDescription = value.rewardDescription;
    }
    if (value.rewardImageUrl !== undefined) data.rewardImageUrl = value.rewardImageUrl;
    if (value.rewardRedemptionCode !== undefined) {
      data.rewardRedemptionCode = value.rewardRedemptionCode;
    }
    if (value.sponsoredThemeId !== undefined) {
      data.sponsoredThemeId = value.sponsoredThemeId;
    }
    if (value.isActive !== undefined) data.isActive = value.isActive;

    if (
      data.inventoryRemaining !== undefined &&
      data.inventoryTotal !== undefined &&
      data.inventoryRemaining > data.inventoryTotal
    ) {
      return res.status(400).json({
        status: false,
        msg: "inventoryRemaining cannot exceed inventoryTotal",
      });
    }

    const updated = await prisma.brandMonthCampaign.update({
      where: { id: req.params.id },
      data,
      include: { commercialVoucher: true, sponsoredTheme: true },
    });

    res.status(200).json({
      status: true,
      msg: "Campaign updated",
      data: mapCampaignResponse(updated),
    });
  } catch (error) {
    res.status(500).json({ status: false, msg: error.message });
  }
};

/**
 * @Description Delete Brand Month campaign
 * @Route DELETE /api/admin/brand-months/:id
 * @Access Private (Admin)
 */
export const deleteBrandMonthCampaign = async (req, res) => {
  try {
    await prisma.brandMonthCampaign.delete({ where: { id: req.params.id } });
    res.status(200).json({ status: true, msg: "Campaign deleted" });
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ status: false, msg: "Campaign not found" });
    }
    res.status(500).json({ status: false, msg: error.message });
  }
};

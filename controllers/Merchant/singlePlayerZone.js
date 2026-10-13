import { prisma } from "../../config/db.js";
import { CreateB2bZoneSchema, UpdateB2bZoneSchema } from "../../schema/Merchant/SinglePlayer.js";
import { getSpGameConfig, isB2bAutoApproveEnabled } from "../../utils/singlePlayerConfig.js";
import { parseJsonIntArray } from "../../utils/configJson.js";

/**
 * @Description Create a B2B Raid Zone (pending Super Admin approval)
 * @Route POST /api/merchant/single-player/b2b-zones
 * @Access Private (Merchant)
 */
export const createB2bZone = async (req, res) => {
  const merchantId = req.merchant.id;
  const { error, value } = CreateB2bZoneSchema(req.body);
  if (error) {
    return res.status(400).json({ status: false, msg: error.message });
  }

  try {
    const configRow = await getSpGameConfig(prisma);
    const allowedHolds = parseJsonIntArray(configRow.allowedHoldDurationHours, [24, 48, 72]);
    if (!allowedHolds.includes(value.holdDurationHours)) {
      return res.status(400).json({
        status: false,
        msg: `holdDurationHours must be one of: ${allowedHolds.join(", ")}`,
      });
    }

    const autoApprove = isB2bAutoApproveEnabled();
    const zone = await prisma.singlePlayerZone.create({
      data: {
        name: value.name,
        latitude: value.latitude,
        longitude: value.longitude,
        radius: value.radius ?? 50,
        city: value.city || null,
        country: value.country || null,
        imageUrl: value.imageUrl || null,
        coinsPerHour: value.coinsPerHour ?? 0,
        zoneType: "B2B",
        merchantId,
        approvalStatus: autoApprove ? "approved" : "pending",
        isActive: autoApprove,
        holdDurationHours: value.holdDurationHours,
        b2bRewardType: value.b2bRewardType,
        b2bRewardTitle: value.b2bRewardTitle,
        b2bRewardDescription: value.b2bRewardDescription || null,
        b2bRewardImageUrl: value.b2bRewardImageUrl || null,
        b2bRewardRedemptionCode: value.b2bRewardRedemptionCode || null,
        brandLogoUrl: value.brandLogoUrl || null,
        eligibilityNote: value.eligibilityNote || null,
        minOwnedZonesRequired: value.minOwnedZonesRequired ?? null,
      },
    });

    res.status(201).json({
      status: true,
      msg: autoApprove
        ? "B2B raid zone created and live on the user map"
        : "B2B raid zone submitted for approval",
      data: zone,
      userMapVisible: autoApprove,
      ...(autoApprove
        ? {}
        : {
            nextStep:
              "Super Admin: POST /api/admin/single-player/b2b/:id/approve — until then users will not see this zone in GET /single-player/zones",
          }),
    });
  } catch (err) {
    res.status(500).json({ status: false, msg: err.message });
  }
};

/**
 * @Description List B2B raid zones created by the logged-in merchant
 * @Route GET /api/merchant/single-player/b2b-zones
 * @Access Private (Merchant)
 */
export const listMyB2bZones = async (req, res) => {
  const merchantId = req.merchant.id;
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const skip = (page - 1) * limit;

  try {
    const where = { merchantId, zoneType: "B2B" };
    const [zones, total] = await Promise.all([
      prisma.singlePlayerZone.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.singlePlayerZone.count({ where }),
    ]);

    res.status(200).json({
      status: true,
      data: zones,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ status: false, msg: error.message });
  }
};

/**
 * @Description Update a pending B2B raid zone (merchant-owned, not yet approved)
 * @Route PUT /api/merchant/single-player/b2b-zones/:id
 * @Access Private (Merchant)
 */
export const updateB2bZone = async (req, res) => {
  const merchantId = req.merchant.id;
  const { id } = req.params;
  const { error, value } = UpdateB2bZoneSchema(req.body);
  if (error) {
    return res.status(400).json({ status: false, msg: error.message });
  }

  try {
    const existing = await prisma.singlePlayerZone.findFirst({
      where: {
        id,
        merchantId,
        zoneType: "B2B",
        approvalStatus: "pending",
      },
    });

    if (!existing) {
      return res.status(404).json({
        status: false,
        msg: "Pending B2B zone not found or cannot be edited",
      });
    }

    if (value.holdDurationHours != null) {
      const configRow = await getSpGameConfig(prisma);
      const allowedHolds = parseJsonIntArray(configRow.allowedHoldDurationHours, [24, 48, 72]);
      if (!allowedHolds.includes(value.holdDurationHours)) {
        return res.status(400).json({
          status: false,
          msg: `holdDurationHours must be one of: ${allowedHolds.join(", ")}`,
        });
      }
    }

    const zone = await prisma.singlePlayerZone.update({
      where: { id },
      data: value,
    });

    res.status(200).json({
      status: true,
      msg: "B2B raid zone updated",
      data: zone,
    });
  } catch (err) {
    res.status(500).json({ status: false, msg: err.message });
  }
};

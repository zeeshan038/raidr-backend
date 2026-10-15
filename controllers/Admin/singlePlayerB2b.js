import { prisma } from "../../config/db.js";
import { getAdminB2bPendingSignal } from "../../utils/adminB2bPendingSignal.js";
import { bumpMerchantB2bApprovalSignal } from "../../utils/merchantB2bApprovalSignal.js";

/**
 * @Description List B2B raid zones pending Super Admin approval
 * @Route GET /api/admin/single-player/b2b/pending
 * @Access Private (Admin)
 */
export const listPendingB2bZones = async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const skip = (page - 1) * limit;

  try {
    const where = {
      zoneType: "B2B",
      merchantId: { not: null },
      NOT: {
        approvalStatus: { in: ["approved", "rejected"] },
      },
    };
    const [zones, total] = await Promise.all([
      prisma.singlePlayerZone.findMany({
        where,
        include: {
          merchant: { select: { id: true, businessName: true, email: true } },
        },
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
 * @Description Approve a merchant B2B raid zone (goes live on map)
 * @Route POST /api/admin/single-player/b2b/:id/approve
 * @Access Private (Admin)
 */
export const approveB2bZone = async (req, res) => {
  const { id } = req.params;

  try {
    const zone = await prisma.singlePlayerZone.findUnique({ where: { id } });
    if (!zone || zone.zoneType !== "B2B") {
      return res.status(404).json({ status: false, msg: "B2B zone not found" });
    }

    const updated = await prisma.singlePlayerZone.update({
      where: { id },
      data: {
        approvalStatus: "approved",
        isActive: true,
      },
    });

    if (zone.merchantId) {
      await bumpMerchantB2bApprovalSignal({
        merchantId: zone.merchantId,
        zoneId: zone.id,
        zoneName: zone.name,
        status: "approved",
      });
    }

    res.status(200).json({
      status: true,
      msg: "B2B zone approved and live",
      data: updated,
    });
  } catch (error) {
    res.status(500).json({ status: false, msg: error.message });
  }
};

/**
 * @Description Reject a merchant B2B raid zone submission
 * @Route POST /api/admin/single-player/b2b/:id/reject
 * @Access Private (Admin)
 */
export const rejectB2bZone = async (req, res) => {
  const { id } = req.params;

  try {
    const zone = await prisma.singlePlayerZone.findUnique({ where: { id } });
    if (!zone || zone.zoneType !== "B2B") {
      return res.status(404).json({ status: false, msg: "B2B zone not found" });
    }

    const updated = await prisma.singlePlayerZone.update({
      where: { id },
      data: {
        approvalStatus: "rejected",
        isActive: false,
      },
    });

    if (zone.merchantId) {
      await bumpMerchantB2bApprovalSignal({
        merchantId: zone.merchantId,
        zoneId: zone.id,
        zoneName: zone.name,
        status: "rejected",
      });
    }

    res.status(200).json({
      status: true,
      msg: "B2B zone rejected",
      data: updated,
    });
  } catch (error) {
    res.status(500).json({ status: false, msg: error.message });
  }
};

/**
 * @Description Lightweight signal for Super Admin polling (new merchant submissions)
 * @Route GET /api/admin/single-player/b2b/pending/signal
 * @Access Private (Admin)
 */
export const getB2bPendingSignal = async (_req, res) => {
  try {
    const signal = await getAdminB2bPendingSignal();
    const pendingCount = await prisma.singlePlayerZone.count({
      where: {
        zoneType: "B2B",
        merchantId: { not: null },
        NOT: {
          approvalStatus: { in: ["approved", "rejected"] },
        },
      },
    });
    res.status(200).json({
      status: true,
      data: {
        ...signal,
        pendingCount,
      },
    });
  } catch (error) {
    res.status(500).json({ status: false, msg: error.message });
  }
};

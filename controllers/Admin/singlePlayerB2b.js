import { prisma } from "../../config/db.js";

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
    const where = { zoneType: "B2B", approvalStatus: "pending" };
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

    res.status(200).json({
      status: true,
      msg: "B2B zone rejected",
      data: updated,
    });
  } catch (error) {
    res.status(500).json({ status: false, msg: error.message });
  }
};

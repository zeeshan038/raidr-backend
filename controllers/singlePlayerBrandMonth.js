import { prisma } from "../config/db.js";
import {
  formatBrandMonthForClient,
  getBrandMonthStateForUser,
} from "../utils/brandMonth.js";

/**
 * @Description Get active Brand Month progression (XP bar, voucher inventory, user prize state)
 * @Route GET /api/single-player/brand-month/active
 * @Access Private
 */
export const getActiveBrandMonth = async (req, res) => {
  try {
    const brandMonth = await getBrandMonthStateForUser(prisma, req.user.id);
    res.status(200).json({
      status: true,
      data: brandMonth,
    });
  } catch (error) {
    res.status(500).json({ status: false, msg: error.message });
  }
};

/**
 * @Description List user's Brand Month participation history
 * @Route GET /api/single-player/brand-month/history
 * @Access Private
 */
export const getBrandMonthHistory = async (req, res) => {
  const userId = req.user.id;

  try {
    const rows = await prisma.brandMonthProgress.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      include: {
        campaign: { include: { commercialVoucher: true } },
        userVoucher: { include: { voucher: true } },
      },
    });

    const data = rows.map((row) =>
      formatBrandMonthForClient(row.campaign, row, row.userVoucher)
    );

    res.status(200).json({ status: true, data });
  } catch (error) {
    res.status(500).json({ status: false, msg: error.message });
  }
};

import { prisma } from "../config/db.js";
import { getEmpireStatus } from "../utils/singlePlayerEmpire.js";

/**
 * @Description Empire / VIP status from currently owned zones
 * @Route GET /api/single-player/empire
 * @Access Private
 */
export const getEmpire = async (req, res) => {
  try {
    const data = await getEmpireStatus(prisma, req.user.id);
    res.status(200).json({ status: true, data });
  } catch (error) {
    res.status(500).json({ status: false, msg: error.message });
  }
};

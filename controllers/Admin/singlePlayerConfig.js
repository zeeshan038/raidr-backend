import { prisma } from "../../config/db.js";
import { UpdateGameConfigSchema } from "../../schema/Admin/SinglePlayer.js";
import { clearSpGameConfigCache, getSpGameConfig } from "../../utils/singlePlayerConfig.js";

/**
 * @Description Get Single Player Phase 2 gameplay configuration
 * @Route GET /api/admin/single-player/config
 * @Access Private (Admin)
 */
export const getGameConfig = async (_req, res) => {
  try {
    const config = await getSpGameConfig(prisma);
    res.status(200).json({ status: true, data: config });
  } catch (error) {
    res.status(500).json({ status: false, msg: error.message });
  }
};

/**
 * @Description Update Single Player gameplay configuration
 * @Route PUT /api/admin/single-player/config
 * @Access Private (Admin)
 */
export const updateGameConfig = async (req, res) => {
  const result = UpdateGameConfigSchema(req.body);
  if (result.error) {
    return res.status(400).json({ status: false, msg: result.error.message });
  }
  const value = result.value;

  try {
    const data = { ...value };
    if (data.rivalryMilestoneHours) {
      data.rivalryMilestoneHours = data.rivalryMilestoneHours;
    }
    if (data.allowedHoldDurationHours) {
      data.allowedHoldDurationHours = data.allowedHoldDurationHours;
    }

    const updated = await prisma.singlePlayerGameConfig.update({
      where: { id: "default" },
      data,
    });
    clearSpGameConfigCache();

    res.status(200).json({
      status: true,
      msg: "Game configuration updated",
      data: updated,
    });
  } catch (err) {
    res.status(500).json({ status: false, msg: err.message });
  }
};

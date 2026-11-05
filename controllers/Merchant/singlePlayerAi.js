import { generateB2bCampaignDraft, generateB2bZoneImages } from "../../utils/GeminiAi.js";

/**
 * @Description AI text-to-campaign draft for B2B raid zone (not published)
 * @Route POST /api/merchant/single-player/b2b-zones/ai-draft
 * @Access Private (Merchant)
 */
export const merchantB2bAiDraft = async (req, res) => {
  const { prompt } = req.body;
  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ status: false, msg: "prompt is required" });
  }

  try {
    const draft = await generateB2bCampaignDraft(prompt);
    res.status(200).json({
      status: true,
      msg: "Draft generated — review and submit via POST /b2b-zones",
      data: { draft, isPublished: false },
    });
  } catch (error) {
    res.status(500).json({ status: false, msg: error.message });
  }
};

/**
 * @Description AI 512×512 transparent PNG assets for B2B zone (map icon + optional reward)
 * @Route POST /api/merchant/single-player/b2b-zones/generate-images
 * @Access Private (Merchant)
 */
export const merchantB2bGenerateImages = async (req, res) => {
  const {
    zoneName,
    rewardTitle,
    brandHint,
    primaryColor,
    secondaryColor,
    referenceImageBase64,
    includeRewardImage,
  } = req.body;

  if (!zoneName || typeof zoneName !== "string") {
    return res.status(400).json({ status: false, msg: "zoneName is required" });
  }

  try {
    const images = await generateB2bZoneImages({
      zoneName,
      rewardTitle,
      brandHint,
      primaryColor,
      secondaryColor,
      referenceImageBase64,
      includeRewardImage: includeRewardImage !== false,
    });
    res.status(200).json({
      status: true,
      msg: "B2B images generated (512×512 PNG, transparent background)",
      data: images,
    });
  } catch (error) {
    res.status(500).json({ status: false, msg: error.message });
  }
};

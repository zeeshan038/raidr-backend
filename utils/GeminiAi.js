import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIME_BY_EXT = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

const getReferenceImageFromFile = (filename) => {
  const filePath = path.join(__dirname, filename);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const ext = path.extname(filename).toLowerCase();
  return {
    inlineData: {
      data: Buffer.from(fs.readFileSync(filePath)).toString("base64"),
      mimeType: MIME_BY_EXT[ext] || "image/jpeg",
    },
  };
};

const getReferenceImageFromBase64 = (base64, mimeType = "image/png") => {
  if (!base64 || typeof base64 !== "string") {
    return null;
  }
  const data = base64.replace(/^data:image\/\w+;base64,/, "");
  return {
    inlineData: { data, mimeType },
  };
};

const loadReferenceImages = (filenames, uploadBase64) => {
  if (uploadBase64) {
    const uploaded = getReferenceImageFromBase64(uploadBase64);
    if (uploaded) {
      return [uploaded];
    }
  }
  return filenames
    .map((name) => getReferenceImageFromFile(name))
    .filter(Boolean);
};

const REFERENCE_ASSET_FILES = {
  drop: ["Drop.jpeg"],
  zone: ["zone.jpeg", "conquered zone.jpeg"],
  map: ["map icon.jpeg"],
};

const REFERENCE_STYLE_BLOCK = (assetLabel) => `
REFERENCE IMAGES (required quality bar):
The attached image(s) are official RAIDR ${assetLabel} samples from our art team.
Treat them as the gold standard for style — NOT for copying any specific brand.

You MUST match this production look:
- Real 3D game asset render (Cinema 4D / Blender / mobile AAA UI quality) — never flat 2D vector art
- Strong depth: beveled edges, thickness, PBR gloss/metal/glass, crisp specular highlights
- Lighting: key + fill + rim light, ambient occlusion, controlled neon accents inside the mesh
- Background: PNG with TRUE transparent alpha outside the object
- Allowed for depth: a soft, semi-transparent CONTACT SHADOW directly under the object only (no floor texture, no room, no map)
- Forbidden: solid white/gray backdrop, checkerboard baked in, photo environments, busy scenes, outer glow halos, text labels

Apply sponsor colors and logo from the written brief while keeping the same 3D craft as the references.
`.trim();

const buildContents = (prompt, refImages, assetLabel) => {
  const parts = [];
  if (refImages.length > 0) {
    parts.push({ text: REFERENCE_STYLE_BLOCK(assetLabel) });
    for (const ref of refImages) {
      parts.push(ref);
    }
  }
  parts.push({ text: prompt });
  return parts;
};

const SHARED_3D_OUTPUT_RULES = `
OUTPUT (all assets):
- Exactly 512x512 pixels, PNG, production-ready for a dark mobile map UI
- Object centered with safe transparent padding; readable at 48px map pin size
- Must read as dimensional 3D at a glance — avoid sticker-like flat shading
`.trim();

/**
 * Generates the three required images for a SponsoredTheme using Gemini.
 * @param {string} themeName
 * @param {string} brandLogo
 * @param {string} primaryColor
 * @param {string} secondaryColor
 * @param {{ referenceImages?: { drop?: string, zone?: string, map?: string } }} [options] - optional base64 samples from admin
 */
export const generateThemeImages = async (
  themeName,
  brandLogo,
  primaryColor,
  secondaryColor,
  options = {}
) => {
  if (!themeName) {
    throw new Error("Theme name is required");
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY or GEMINI_KEY is missing in .env");
  }

  const ai = new GoogleGenAI({ apiKey });
  const uploadedRefs = options.referenceImages || {};

  try {
    console.log(`Generating images for theme: ${themeName}...`);

    const primary = primaryColor || "associated with the brand";
    const secondary = secondaryColor || "associated with the brand";
    const logoHint = brandLogo || "the brand's official logo mark";

    const dropImagePrompt = `
Create ONE premium sponsored Daily Drop game asset for "${themeName}".

${SHARED_3D_OUTPUT_RULES}

SUBJECT:
- A premium 3D gift box with ribbon and bow — chunky, tactile, toy-like volume
- Polished materials with realistic depth, bevels, reflections, inner glow on edges
- Dominant colors: primary ${primary}, secondary ${secondary}
- Place ${logoHint} on the front face; integrated into the surface (embossed/engraved/illuminated), not a flat sticker
- No extra text or invented slogans

BACKGROUND:
- Transparent alpha everywhere except an optional soft contact shadow beneath the box to reinforce 3D grounding
`.trim();

    const zoneImagePrompt = `
Create ONE premium sponsored Raid Zone icon for "${themeName}".

${SHARED_3D_OUTPUT_RULES}

FIXED COMPOSITION (match RAIDR zone references):
- Symmetrical 3D SHIELD outer shape with layered beveled edges and glass/metal premium materials
- Simple 3D CASTLE / FORT / ROOK symbol centered inside the shield
- Keep shield + fort silhouette identical in structure to the reference samples; only recolor and add sponsor branding
- Controlled internal neon on edges; no large external bloom

SPONSOR:
- Colors: primary ${primary}, secondary ${secondary}
- Integrate ${logoHint} subtly inside the shield; readable at small map sizes
- Do not replace the fort with food/products/random objects

BACKGROUND:
- Transparent alpha; optional soft contact shadow under the shield only
`.trim();

    const mapLogoPrompt = `
Create ONE premium sponsored map location marker for "${themeName}".

${SHARED_3D_OUTPUT_RULES}

FIXED SHAPE (match RAIDR map pin references):
- Classic location PIN silhouette — thick, beveled, glossy 3D pin
- Circular head with depth; premium glass/metal materials and subtle internal neon
- Colors: primary ${primary}, secondary ${secondary}
- ${logoHint} centered in the pin head; crisp and recognizable when small

BACKGROUND:
- Transparent alpha; optional soft contact shadow under the pin tip only
- No map tiles, circles, rings, or labels
`.trim();

    const modelName = "gemini-3.1-flash-image";

    const dropRefs = loadReferenceImages(
      REFERENCE_ASSET_FILES.drop,
      uploadedRefs.drop
    );
    const zoneRefs = loadReferenceImages(
      REFERENCE_ASSET_FILES.zone,
      uploadedRefs.zone
    );
    const mapRefs = loadReferenceImages(
      REFERENCE_ASSET_FILES.map,
      uploadedRefs.map
    );

    if (dropRefs.length === 0 || zoneRefs.length === 0 || mapRefs.length === 0) {
      console.warn(
        "[GeminiAi] Missing one or more local reference JPEGs in utils/ — output quality may drop. Ask design to add Drop.jpeg, zone.jpeg, map icon.jpeg."
      );
    }

    const [dropImgRes, zoneImgRes, mapLogoRes] = await Promise.all([
      ai.models.generateContent({
        model: modelName,
        contents: buildContents(dropImagePrompt, dropRefs, "Daily Drop"),
        config: { outputMimeType: "image/png" },
      }),
      ai.models.generateContent({
        model: modelName,
        contents: buildContents(zoneImagePrompt, zoneRefs, "Raid Zone"),
        config: { outputMimeType: "image/png" },
      }),
      ai.models.generateContent({
        model: modelName,
        contents: buildContents(mapLogoPrompt, mapRefs, "Map Pin"),
        config: { outputMimeType: "image/png" },
      }),
    ]);

    const extractBase64 = (res) => {
      const part = res.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
      return part ? part.inlineData.data : null;
    };

    const dropImageBase64 = extractBase64(dropImgRes);
    const zoneImageBase64 = extractBase64(zoneImgRes);
    const mapLogoBase64 = extractBase64(mapLogoRes);

    if (!dropImageBase64 || !zoneImageBase64 || !mapLogoBase64) {
      throw new Error("Failed to extract image bytes from response.");
    }

    return {
      dropImageBase64,
      zoneImageBase64,
      mapLogoBase64,
    };
  } catch (error) {
    console.error("Error generating theme images:", error);
    throw new Error(error.message || "Failed to generate theme images using Gemini API.");
  }
};

/**
 * Generates bulk Single Player Zones based on a prompt.
 */
export const generateBulkZones = async (prompt, count) => {
  if (!prompt || !count) {
    throw new Error("Prompt and count are required");
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is missing in .env");
  }

  const OpenAI = (await import("openai")).default;
  const openai = new OpenAI({ apiKey });

  try {
    console.log(`Generating ${count} bulk zones for prompt: ${prompt}...`);

    const schema = {
      name: "zones_schema",
      schema: {
        type: "object",
        properties: {
          zones: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                latitude: { type: "number" },
                longitude: { type: "number" },
                city: { type: "string" },
                country: { type: "string" },
              },
              required: ["name", "latitude", "longitude", "city", "country"],
              additionalProperties: false,
            },
          },
        },
        required: ["zones"],
        additionalProperties: false,
      },
      strict: true,
    };

    const systemInstruction = `You are a geographical data assistant for a real-world mobile game. The user will ask for a certain number of gaming zones in a specific area. You must return exactly the requested number of zones. Generate realistic, precise, and distinct latitude and longitude coordinates within the requested area. Provide a plausible gaming zone name for each location (e.g., "Central Park Plaza Zone").`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: `Generate exactly ${count} zones based on this request: "${prompt}"` },
      ],
      response_format: { type: "json_schema", json_schema: schema },
    });

    const text = response.choices[0].message.content;
    const parsedData = JSON.parse(text);
    const data = parsedData.zones;

    if (!Array.isArray(data) || data.length !== count) {
      console.warn(`Expected ${count} zones, but AI returned ${Array.isArray(data) ? data.length : 0}`);
    }

    return data;
  } catch (error) {
    console.error("Error generating bulk zones with OpenAI:", error);
    throw new Error(error.message || "Failed to generate bulk zones using OpenAI API.");
  }
};

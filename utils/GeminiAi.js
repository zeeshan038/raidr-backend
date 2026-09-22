import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const getReferenceImage = (filename) => {
  const filePath = path.join(__dirname, filename);
  if (fs.existsSync(filePath)) {
    return {
      inlineData: {
        data: Buffer.from(fs.readFileSync(filePath)).toString("base64"),
        mimeType: "image/jpeg"
      }
    };
  }
  return null;
};

/**
 * Generates the three required images for a SponsoredTheme using Gemini (Imagen 3).
 * @param {string} themeName - The name of the theme (e.g., "McDonalds")
 * @param {string} brandLogo - Description or text of the brand logo
 * @param {string} primaryColor - The primary color
 * @param {string} secondaryColor - The secondary color
 * @returns {Promise<{dropImageBase64: string, zoneImageBase64: string, mapLogoBase64: string}>}
 */
export const generateThemeImages = async (themeName, brandLogo, primaryColor, secondaryColor) => {
  if (!themeName) {
    throw new Error("Theme name is required");
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY or GEMINI_KEY is missing in .env");
  }

  // Initialize the SDK with the explicitly provided key
  const ai = new GoogleGenAI({ apiKey });

  try {
    console.log(`Generating images for theme: ${themeName}...`);

    const dropImagePrompt = `
Create ONE premium sponsored Daily Drop game asset for the brand "${themeName}".

STRICT OUTPUT REQUIREMENTS:
- Exactly 512x512 pixels.
- PNG with TRUE transparent alpha background.
- Absolutely no background, scene, floor, platform, shadow backdrop, border, frame, or surrounding objects.
- Asset must be centered and fully visible with comfortable transparent padding.
- Extremely sharp, high-detail, production-quality mobile game asset. No blur or pixelation.

DESIGN:
- A premium 3D gift box with a ribbon and bow.
- Polished, glossy, dimensional game-asset appearance with realistic depth, bevels, reflections and controlled neon highlights.
- Use ONLY the primary color (${primaryColor || "associated with the brand"}) and secondary color (${secondaryColor || "associated with the brand"}) as the dominant visual theme.
- Integrate the brand logo ("${brandLogo || "associated with the brand"}") of "${themeName}" clearly on the front face of the gift box.
- Branding must feel naturally integrated into the object, not pasted on.
- Keep the logo clean, readable and recognizable at small mobile UI sizes.
- Do not invent additional brand names, slogans or text.
- Maintain a futuristic premium RAIDR-style game aesthetic while preserving the sponsor's brand identity.

FINAL RESULT:
One isolated 3D sponsored gift-box icon, transparent background, suitable for direct use on a dark mobile game map.
`;

    const zoneImagePrompt = `
Create ONE premium sponsored Raid Zone icon for the brand "${themeName}".

STRICT OUTPUT REQUIREMENTS:
- Exactly 512x512 pixels.
- PNG with TRUE transparent alpha background.
- Absolutely no background, checkerboard baked into the image, outer scene, rays, circles, particles, arrows, decorative lines, or surrounding objects.
- Entire icon must remain inside the 512x512 canvas with transparent padding.
- Extremely sharp, high-detail, production-quality mobile game asset.

FIXED DESIGN LANGUAGE:
- Use a symmetrical 3D SHIELD as the outer shape.
- Place a simple 3D CASTLE / FORT / ROOK symbol prominently in the center.
- Preserve this shield + fort composition for EVERY sponsored theme.
- Shield should have layered beveled edges, glossy/glass-like depth and premium game-quality materials.
- Use controlled internal neon illumination and highlights; do NOT create large glow effects outside the shield.

SPONSOR BRANDING:
- Adapt the shield, fort highlights and neon lighting to the primary color (${primaryColor || "associated with the brand"}) and secondary color (${secondaryColor || "associated with the brand"}) of "${themeName}".
- Incorporate the brand logo ("${brandLogo || "associated with the brand"}") of "${themeName}" subtly but clearly within the shield design.
- The sponsor identity must be recognizable without destroying the shield/fort silhouette.
- Do not add slogans or unnecessary text.
- Do not replace the fort with a random object.

STYLE:
Premium futuristic RAIDR game UI, 3D, glossy, dimensional, sharp, sophisticated and readable even when displayed as a small map icon.

FINAL RESULT:
One isolated 3D branded Raid Zone shield icon with castle/fort symbol, transparent background, ready for direct mobile-app use.
`;

    const mapLogoPrompt = `
Create ONE premium sponsored map location marker for the brand "${themeName}".

STRICT OUTPUT REQUIREMENTS:
- Exactly 512x512 pixels.
- PNG with TRUE transparent alpha background.
- No background, map, ground circle, platform, external rings, rays, particles, scenery, text labels or additional objects.
- Center the marker with transparent padding around it.
- Extremely sharp and clean at high resolution.

FIXED SHAPE:
- Use a classic simple LOCATION PIN silhouette.
- Premium polished 3D construction with beveled edges, glossy/glass-like materials, reflections and subtle internal neon lighting.
- Keep the silhouette simple and highly readable when scaled down on a mobile map.

SPONSOR BRANDING:
- Use the primary color (${primaryColor || "associated with the brand"}) and secondary color (${secondaryColor || "associated with the brand"}) of "${themeName}" throughout the pin.
- Clearly place the brand logo ("${brandLogo || "associated with the brand"}") of "${themeName}" inside the circular center of the marker.
- The logo must remain recognizable at small sizes.
- Do not write the full company name unless it is itself the brand's short official logo.
- Do not invent or modify the sponsor logo.

STYLE:
Premium futuristic RAIDR game UI, polished 3D, clean neon accents, strong contrast and professional mobile-game quality.

FINAL RESULT:
One isolated sponsored 3D location pin on a transparent background, ready for direct use as a map marker.
`;

    const modelName = "gemini-3.1-flash-image"; 

    const dropImageRef = getReferenceImage("Drop.jpeg");
    const zoneImageRef = getReferenceImage("zone.jpeg");
    const mapLogoRef = getReferenceImage("map icon.jpeg");

    const buildContents = (prompt, refImage) => {
      const parts = [{ text: prompt }];
      if (refImage) {
        // Add text instruction to use the reference image
        parts.unshift({ text: "Use the provided image as a strong style and composition reference for generating the final asset." });
        parts.unshift(refImage);
      }
      return parts;
    };

    const [dropImgRes, zoneImgRes, mapLogoRes] = await Promise.all([
      ai.models.generateContent({
        model: modelName,
        contents: buildContents(dropImagePrompt, dropImageRef),
        config: { outputMimeType: "image/png" }
      }),
      ai.models.generateContent({
        model: modelName,
        contents: buildContents(zoneImagePrompt, zoneImageRef),
        config: { outputMimeType: "image/png" }
      }),
      ai.models.generateContent({
        model: modelName,
        contents: buildContents(mapLogoPrompt, mapLogoRef),
        config: { outputMimeType: "image/png" }
      })
    ]);

    const extractBase64 = (res) => {
      const part = res.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
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
      mapLogoBase64
    };

  } catch (error) {
    console.error("Error generating theme images:", error);
    throw new Error(error.message || "Failed to generate theme images using Gemini API.");
  }
};

/**
 * Generates bulk Single Player Zones based on a prompt.
 * @param {string} prompt - The natural language request (e.g., "10 zones in Times Square, New York")
 * @param {number} count - The exact number of zones to generate
 * @returns {Promise<Array<{name: string, latitude: number, longitude: number, city: string, country: string}>>}
 */
export const generateBulkZones = async (prompt, count) => {
  if (!prompt || !count) {
    throw new Error("Prompt and count are required");
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is missing in .env");
  }

  // Import OpenAI dynamically so it doesn't break if not available
  const OpenAI = (await import('openai')).default;
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
                country: { type: "string" }
              },
              required: ["name", "latitude", "longitude", "city", "country"],
              additionalProperties: false
            }
          }
        },
        required: ["zones"],
        additionalProperties: false
      },
      strict: true
    };

    const systemInstruction = `You are a geographical data assistant for a real-world mobile game. The user will ask for a certain number of gaming zones in a specific area. You must return exactly the requested number of zones. Generate realistic, precise, and distinct latitude and longitude coordinates within the requested area. Provide a plausible gaming zone name for each location (e.g., "Central Park Plaza Zone").`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: `Generate exactly ${count} zones based on this request: "${prompt}"` }
      ],
      response_format: { type: "json_schema", json_schema: schema }
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

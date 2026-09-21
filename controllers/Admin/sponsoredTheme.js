import { prisma } from "../../config/db.js";
import { generateThemeImages } from "../../utils/GeminiAi.js";


/**
 * @Description Create Theme
 * @Route POST /api/admin/sponsored-theme
 * @Access Private
 */
export const createTheme = async (req, res) => {
  try {
    const { name, startDate, endDate, dropImageUrl, zoneImageUrl, mapLogoUrl, isActive, latitude, longitude, radius } = req.body;
    
    if (!name || !startDate || !endDate) {
      return res.status(400).json({ status: false, msg: "Name, startDate, and endDate are required" });
    }

    const theme = await prisma.sponsoredTheme.create({
      data: {
        name,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        dropImageUrl,
        zoneImageUrl,
        mapLogoUrl,
        isActive: isActive !== undefined ? isActive : true,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        radius: radius ? parseFloat(radius) : 5000
      }
    });

    res.status(201).json({ status: true, msg: "Theme created successfully", data: theme });
  } catch (error) {
    res.status(500).json({ status: false, msg: error.message });
  }
};

/**
 * @Description Get All Themes
 * @Route GET /api/admin/sponsored-theme
 * @Access Private
 */
export const getThemes = async (req, res) => {
  try {
    const themes = await prisma.sponsoredTheme.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.status(200).json({ status: true, data: themes });
  } catch (error) {
    res.status(500).json({ status: false, msg: error.message });
  }
};


/**
 * @Description Update Theme
 * @Route PUT /api/admin/sponsored-theme/:id
 * @Access Private
 */
export const updateTheme = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, startDate, endDate, dropImageUrl, zoneImageUrl, mapLogoUrl, isActive, latitude, longitude, radius } = req.body;

    const theme = await prisma.sponsoredTheme.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) }),
        ...(dropImageUrl && { dropImageUrl }),
        ...(zoneImageUrl && { zoneImageUrl }),
        ...(mapLogoUrl && { mapLogoUrl }),
        ...(isActive !== undefined && { isActive }),
        ...(latitude !== undefined && { latitude: latitude ? parseFloat(latitude) : null }),
        ...(longitude !== undefined && { longitude: longitude ? parseFloat(longitude) : null }),
        ...(radius !== undefined && { radius: radius ? parseFloat(radius) : null })
      }
    });

    res.status(200).json({ status: true, msg: "Theme updated successfully", data: theme });
  } catch (error) {
    res.status(500).json({ status: false, msg: error.message });
  }
};

/**
 * @Description Delete Theme
 * @Route DELETE /api/admin/sponsored-theme/:id
 * @Access Private
 */
export const deleteTheme = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.sponsoredTheme.delete({ where: { id } });
    res.status(200).json({ status: true, msg: "Theme deleted successfully" });
  } catch (error) {
    res.status(500).json({ status: false, msg: error.message });
  }
};

/**
 * @Description Generate Theme Images using Gemini API
 * @Route POST /api/admin/sponsored-theme/generate-images
 * @Access Private
 */
export const generateThemeImagesController = async (req, res) => {
  try {
    const { name, brandLogo, primaryColor, secondaryColor } = req.body;
    if (!name) {
      return res.status(400).json({ status: false, msg: "Theme name is required" });
    }
    const images = await generateThemeImages(name, brandLogo, primaryColor, secondaryColor);
    res.status(200).json({ status: true, msg: "Images generated successfully", data: images });
  } catch (error) {
    res.status(500).json({
      status: false,
      msg: error.message
    });
  }
};

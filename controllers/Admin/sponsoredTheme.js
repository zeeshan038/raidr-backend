import { prisma } from "../../config/db.js";

// Create Theme
export const createTheme = async (req, res) => {
  try {
    const { name, startDate, endDate, dropImageUrl, zoneImageUrl, mapLogoUrl } = req.body;
    
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
        mapLogoUrl
      }
    });

    res.status(201).json({ status: true, msg: "Theme created successfully", data: theme });
  } catch (error) {
    res.status(500).json({ status: false, msg: error.message });
  }
};

// Get All Themes
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

// Update Theme
export const updateTheme = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, startDate, endDate, dropImageUrl, zoneImageUrl, mapLogoUrl, isActive } = req.body;

    const theme = await prisma.sponsoredTheme.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) }),
        ...(dropImageUrl !== undefined && { dropImageUrl }),
        ...(zoneImageUrl !== undefined && { zoneImageUrl }),
        ...(mapLogoUrl !== undefined && { mapLogoUrl }),
        ...(isActive !== undefined && { isActive })
      }
    });

    res.status(200).json({ status: true, msg: "Theme updated successfully", data: theme });
  } catch (error) {
    res.status(500).json({ status: false, msg: error.message });
  }
};

// Delete Theme
export const deleteTheme = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.sponsoredTheme.delete({ where: { id } });
    res.status(200).json({ status: true, msg: "Theme deleted successfully" });
  } catch (error) {
    res.status(500).json({ status: false, msg: error.message });
  }
};

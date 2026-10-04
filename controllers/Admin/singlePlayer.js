import { prisma } from "../../config/db.js";
import { CreateZoneSchema, UpdateZoneSchema } from "../../schema/Admin/SinglePlayer.js";
import { generateBulkZones } from "../../utils/GeminiAi.js";

/**
 * @Description Create a new Single Player Zone
 * @Route POST /api/admin/single-player/create
 * @Access Private (Admin)
 */
export const createZone = async (req, res) => {

  const payload = req.body

      const { error } = CreateZoneSchema(payload);
    if (error) {
      return res.status(400).json({
        status: false,
        msg: error.message,
      });
    }
  try {
    let imageUrl = null;
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;

    // Fetch image from Google Places API if key is present
    if (apiKey && payload.latitude && payload.longitude && payload.name) {
      try {
        const searchUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(payload.name)}&inputtype=textquery&locationbias=point:${payload.latitude},${payload.longitude}&fields=photos&key=${apiKey}`;
        const searchRes = await fetch(searchUrl);
        const searchData = await searchRes.json();

        if (searchData.candidates && searchData.candidates.length > 0) {
          const candidate = searchData.candidates[0];
          if (candidate.photos && candidate.photos.length > 0) {
            const photoRef = candidate.photos[0].photo_reference;
            imageUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${photoRef}&key=${apiKey}`;
          }
        }
      } catch (err) {
        console.error("Failed to fetch Google Place Image:", err.message);
      }
    }

    const zone = await prisma.singlePlayerZone.create({
      data: {
        name: payload.name,
        latitude: parseFloat(payload.latitude),
        longitude: parseFloat(payload.longitude),
        radius: payload.radius ? parseInt(payload.radius) : 50,
        isActive: payload.isActive !== undefined ? payload.isActive : true,
        coinsPerHour: payload.coinsPerHour !== undefined ? parseInt(payload.coinsPerHour) : 60,
        city: payload.city || null,
        country: payload.country || null,
        imageUrl: imageUrl,
      },
    });

    res.status(201).json({
      status: true,
      msg: "Zone created successfully",
      data: zone,
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      msg: error.message,
    });
  }
};

/**
 * @Description Get all Single Player Zones (Admin view, includes inactive)
 * @Route GET /api/admin/single-player/zones
 * @Access Private (Admin)
 */
export const getAllZones = async (req, res) => {
  try {
    const { city, country, page = 1, limit = 10 } = req.query;
    
    const where = {};
    if (city) where.city = { contains: city, mode: 'insensitive' };
    if (country) where.country = { contains: country, mode: 'insensitive' };

    const pageNumber = parseInt(page, 10) || 1;
    const limitNumber = parseInt(limit, 10) || 10;
    const skip = (pageNumber - 1) * limitNumber;

    const [zones, total] = await Promise.all([
      prisma.singlePlayerZone.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNumber,
        include: {
          owner: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      prisma.singlePlayerZone.count({ where })
    ]);

    res.status(200).json({
      status: true,
      data: zones,
      pagination: {
        total,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.ceil(total / limitNumber)
      }
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      msg: error.message,
    });
  }
};

/**
 * @Description Update a Single Player Zone
 * @Route PUT /api/admin/single-player/zones/:id
 * @Access Private (Admin)
 */
export const updateZone = async (req, res) => {
    const payload = req.body
    const { id } = req.params;
    
    const { error } = UpdateZoneSchema(payload);
    if (error) {
      return res.status(400).json({
        status: false,
        msg: error.message,
      });
    }
  try {
 

    const zone = await prisma.singlePlayerZone.findUnique({ where: { id } });
    if (!zone) {
      return res.status(404).json({
        status: false,
        msg: "Zone not found",
      });
    }

    const updatedZone = await prisma.singlePlayerZone.update({
      where: { id },
      data: {
        name: payload.name,
        latitude: payload.latitude ? parseFloat(payload.latitude) : zone.latitude,
        longitude: payload.longitude ? parseFloat(payload.longitude) : zone.longitude,
        radius: payload.radius ? parseInt(payload.radius) : zone.radius,
        isActive: payload.isActive !== undefined ? payload.isActive : zone.isActive,
        coinsPerHour: payload.coinsPerHour !== undefined ? parseInt(payload.coinsPerHour) : zone.coinsPerHour,
        city: payload.city !== undefined ? payload.city : zone.city,
        country: payload.country !== undefined ? payload.country : zone.country,
      },
    });

    res.status(200).json({
      status: true,
      msg: "Zone updated successfully",
      data: updatedZone,
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      msg: error.message,
    });
  }
};

/**
 * @Description Delete a Single Player Zone
 * @Route DELETE /api/admin/single-player/zones/:id
 * @Access Private (Admin)
 */
export const deleteZone = async (req, res) => {
  try {
    const { id } = req.params;

    const zone = await prisma.singlePlayerZone.findUnique({ where: { id } });
    if (!zone) {
      return res.status(404).json({
        status: false,
        msg: "Zone not found",
      });
    }

    await prisma.singlePlayerZone.delete({ where: { id } });

    res.status(200).json({
      status: true,
      msg: "Zone deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      msg: error.message,
    });
  }
};

/**
 * @Description Generate and insert bulk Single Player Zones via AI
 * @Route POST /api/admin/single-player/zones/bulk-generate
 * @Access Private (Admin)
 */
export const generateBulkZonesController = async (req, res) => {
  try {
    const { prompt, count, radius, coinsPerHour } = req.body;

    if (!prompt || !count || count <= 0) {
      return res.status(400).json({
        status: false,
        msg: "Prompt and a valid count are required",
      });
    }

    if (count > 100) {
      return res.status(400).json({
        status: false,
        msg: "Count cannot exceed 100 per request",
      });
    }

    const aiZones = await generateBulkZones(prompt, count);

    if (!aiZones || aiZones.length === 0) {
      return res.status(500).json({
        status: false,
        msg: "Failed to generate zones from AI",
      });
    }

    // Prepare data for bulk insert
    const zonesToCreate = aiZones.map(zone => ({
      name: zone.name,
      latitude: parseFloat(zone.latitude),
      longitude: parseFloat(zone.longitude),
      city: zone.city || null,
      country: zone.country || null,
      radius: radius ? parseInt(radius) : 50,
      coinsPerHour: coinsPerHour !== undefined ? parseInt(coinsPerHour) : 60,
      isActive: true,
      imageUrl: null // Skipping Google Places image fetch for bulk inserts to avoid rate limits/latency
    }));

    const created = await prisma.singlePlayerZone.createMany({
      data: zonesToCreate,
      skipDuplicates: true // Just in case
    });

    res.status(201).json({
      status: true,
      msg: `Successfully generated and inserted ${created.count} zones`,
      data: zonesToCreate
    });

  } catch (error) {
    console.error("Error in generateBulkZonesController:", error);
    res.status(500).json({
      status: false,
      msg: error.message || "An error occurred during bulk generation",
    });
  }
};

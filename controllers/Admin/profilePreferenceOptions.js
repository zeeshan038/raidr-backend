import { prisma } from "../../config/db.js";
import {
  AdminProfileOptionCreateSchema,
  AdminProfileOptionUpdateSchema,
} from "../../schema/UserProfilePreferences.js";
import { formatProfilePreferenceOption } from "../../utils/profilePreferences.js";

/**
 * @Description List profile onboarding options (cities, interests, gender, age)
 * @Route GET /api/admin/profile-preference-options
 * @Access Private
 */
export const listProfilePreferenceOptions = async (req, res) => {
  try {
    const { type } = req.query;
    const where = type ? { type: String(type).toUpperCase() } : {};

    const rows = await prisma.profilePreferenceOption.findMany({
      where,
      orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { label: "asc" }],
    });

    res.status(200).json({
      status: true,
      data: rows.map(formatProfilePreferenceOption),
    });
  } catch (error) {
    res.status(500).json({ status: false, msg: error.message });
  }
};

/**
 * @Description Create a profile onboarding option
 * @Route POST /api/admin/profile-preference-options
 * @Access Private
 */
export const createProfilePreferenceOption = async (req, res) => {
  const { error, value } = AdminProfileOptionCreateSchema(req.body);
  if (error) {
    return res.status(400).json({ status: false, msg: error.details[0].message });
  }

  try {
    const row = await prisma.profilePreferenceOption.create({
      data: {
        type: value.type,
        label: value.label,
        subtitle: value.subtitle || null,
        iconKey: value.iconKey || null,
        accentColor: value.accentColor || null,
        slug: value.slug || null,
        sortOrder: value.sortOrder ?? 0,
        isActive: value.isActive !== undefined ? value.isActive : true,
      },
    });

    res.status(201).json({
      status: true,
      msg: "Option created",
      data: formatProfilePreferenceOption(row),
    });
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({ status: false, msg: "Option slug already exists for this type" });
    }
    res.status(500).json({ status: false, msg: error.message });
  }
};

/**
 * @Description Update a profile onboarding option
 * @Route PUT /api/admin/profile-preference-options/:id
 * @Access Private
 */
export const updateProfilePreferenceOption = async (req, res) => {
  const { error, value } = AdminProfileOptionUpdateSchema(req.body);
  if (error) {
    return res.status(400).json({ status: false, msg: error.details[0].message });
  }

  try {
    const row = await prisma.profilePreferenceOption.update({
      where: { id: req.params.id },
      data: {
        ...(value.type !== undefined && { type: value.type }),
        ...(value.label !== undefined && { label: value.label }),
        ...(value.subtitle !== undefined && { subtitle: value.subtitle || null }),
        ...(value.iconKey !== undefined && { iconKey: value.iconKey || null }),
        ...(value.accentColor !== undefined && { accentColor: value.accentColor || null }),
        ...(value.slug !== undefined && { slug: value.slug || null }),
        ...(value.sortOrder !== undefined && { sortOrder: value.sortOrder }),
        ...(value.isActive !== undefined && { isActive: value.isActive }),
      },
    });

    res.status(200).json({
      status: true,
      msg: "Option updated",
      data: formatProfilePreferenceOption(row),
    });
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ status: false, msg: "Option not found" });
    }
    res.status(500).json({ status: false, msg: error.message });
  }
};

/**
 * @Description Delete a profile onboarding option
 * @Route DELETE /api/admin/profile-preference-options/:id
 * @Access Private
 */
export const deleteProfilePreferenceOption = async (req, res) => {
  try {
    await prisma.profilePreferenceOption.delete({ where: { id: req.params.id } });
    res.status(200).json({ status: true, msg: "Option deleted" });
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ status: false, msg: "Option not found" });
    }
    res.status(500).json({ status: false, msg: error.message });
  }
};

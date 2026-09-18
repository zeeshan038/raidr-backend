import { prisma } from "../../config/db.js";

/**
 * @Description Create a Commercial Voucher
 * @Route POST /api/admin/vouchers
 * @Access Private
 */
export const createVoucher = async (req, res) => {
  try {
    const { title, description, sponsorName, imageUrl, redemptionCode, quantity } = req.body;

    if (!title || !sponsorName || quantity === undefined) {
      return res.status(400).json({ status: false, msg: "Title, sponsorName, and quantity are required" });
    }

    const voucher = await prisma.commercialVoucher.create({
      data: {
        title,
        description,
        sponsorName,
        imageUrl,
        redemptionCode,
        quantity: parseInt(quantity)
      }
    });

    res.status(201).json({ status: true, msg: "Voucher created successfully", data: voucher });
  } catch (error) {
    res.status(500).json({ status: false, msg: error.message });
  }
};

/**
 * @Description Get all Commercial Vouchers
 * @Route GET /api/admin/vouchers
 * @Access Private
 */
export const getVouchers = async (req, res) => {
  try {
    const vouchers = await prisma.commercialVoucher.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.status(200).json({ status: true, data: vouchers });
  } catch (error) {
    res.status(500).json({ status: false, msg: error.message });
  }
};

/**
 * @Description Update a Commercial Voucher
 * @Route PUT /api/admin/vouchers/:id
 * @Access Private
 */
export const updateVoucher = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, sponsorName, imageUrl, redemptionCode, quantity, isActive } = req.body;

    const voucher = await prisma.commercialVoucher.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(sponsorName && { sponsorName }),
        ...(imageUrl !== undefined && { imageUrl }),
        ...(redemptionCode !== undefined && { redemptionCode }),
        ...(quantity !== undefined && { quantity: parseInt(quantity) }),
        ...(isActive !== undefined && { isActive })
      }
    });

    res.status(200).json({ status: true, msg: "Voucher updated successfully", data: voucher });
  } catch (error) {
    res.status(500).json({ status: false, msg: error.message });
  }
};

/**
 * @Description Delete a Commercial Voucher
 * @Route DELETE /api/admin/vouchers/:id
 * @Access Private
 */
export const deleteVoucher = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.commercialVoucher.delete({ where: { id } });
    res.status(200).json({ status: true, msg: "Voucher deleted successfully" });
  } catch (error) {
    res.status(500).json({ status: false, msg: error.message });
  }
};

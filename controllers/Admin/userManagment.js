import { prisma } from "../../config/db.js";

/**
 * @Description Delete User
 * @Route GET api/admin/users/delete/id
 * @Access Private
 */
export const deleteUserById = async (req, res) => {
    const { id } = req.params;

    if (!id) {
        return res.status(400).json({
            status: false,
            msg: "User ID is required"
        });
    }

    try {
        const existingUser = await prisma.user.findUnique({ where: { id: id } });
        if (!existingUser) {
            return res.status(404).json({
                status: false,
                msg: "User not found"
            });
        }
        
        // Delete related records that don't have onDelete: Cascade in Prisma schema
        await prisma.trip.deleteMany({ where: { userId: id } });
        await prisma.adImpression.deleteMany({ where: { userId: id } });

        const user = await prisma.user.delete({ where: { id: id } });

        const userResponse = { ...user, _id: user.id };
        delete userResponse.password;

        return res.status(200).json({
            status: true,
            msg: "User deleted successfully",
            user: userResponse
        });
    } catch (error) {
        return res.status(500).json({
            status: false,
            msg: error.message
        });
    }
}

/**
 * @Description Get All Users
 * @Route GET api/admin/users
 * @Access Private
 */
export const getAllUsers = async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                name: true,
                email: true,
                isVerified: true,
                authProvider: true,
                photoUrl: true,
                createdAt: true,
                updatedAt: true
            }
        });

        return res.status(200).json({
            status: true,
            msg: "Users fetched successfully",
            users
        });
    } catch (error) {
        return res.status(500).json({
            status: false,
            msg: error.message
        });
    }
}

/**
 * @Description Get Single User
 * @Route GET api/admin/users/:id
 * @Access Private
 */
export const getUserById = async (req, res) => {
    const { id } = req.params;
    
    if (!id) {
        return res.status(400).json({ status: false, msg: "User ID is required" });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { id: id },
            select: {
                id: true,
                name: true,
                email: true,
                isVerified: true,
                authProvider: true,
                photoUrl: true,
                createdAt: true,
                updatedAt: true,
                level: true,
                xp_earned: true,
                raidrCoins: true
            }
        });

        if (!user) {
            return res.status(404).json({ status: false, msg: "User not found" });
        }

        return res.status(200).json({
            status: true,
            msg: "User fetched successfully",
            user
        });
    } catch (error) {
        return res.status(500).json({
            status: false,
            msg: error.message
        });
    }
}

/**
 * @Description Update User
 * @Route PUT api/admin/users/update/:id
 * @Access Private
 */
export const updateUserById = async (req, res) => {
    const { id } = req.params;
    const payload = req.body;

    if (!id) {
        return res.status(400).json({ status: false, msg: "User ID is required" });
    }

    try {
        const existingUser = await prisma.user.findUnique({ where: { id: id } });
        if (!existingUser) {
            return res.status(404).json({ status: false, msg: "User not found" });
        }

        // Avoid letting admin update password or id directly through this simple update
        delete payload.password;
        delete payload.id;

        const updatedUser = await prisma.user.update({
            where: { id: id },
            data: payload
        });

        const userResponse = { ...updatedUser, _id: updatedUser.id };
        delete userResponse.password;

        return res.status(200).json({
            status: true,
            msg: "User updated successfully",
            user: userResponse
        });
    } catch (error) {
        return res.status(500).json({
            status: false,
            msg: error.message
        });
    }
}
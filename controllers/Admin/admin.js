import bcrypt from "bcrypt";
import { prisma } from "../../config/db.js";
import { RegisterAdminSchema, LoginAdminSchema } from "../../schema/Admin/Admin.js";
import { generateToken } from "../../utils/methods/methods.js";

/**
 * @Description Register Admin
 * @Route POST /api/admin/register
 * @Access Public
 */
export const registerAdmin = async (req, res) => {
    const payload = req.body;

    const result = RegisterAdminSchema(payload);
    if (result.error) {
        return res.status(400).json({
            status: false,
            msg: result.error.message
        });
    }
    
    try {
        const existingAdmin = await prisma.admin.findUnique({
            where: { email: payload.email }
        });

        if (existingAdmin) {
            return res.status(400).json({
                status: false,
                msg: "Admin already exists with this email"
            });
        }

        const hashedPassword = await bcrypt.hash(payload.password, 10);

        const admin = await prisma.admin.create({
            data: {
                name: payload.name,
                email: payload.email,
                password: hashedPassword
            }
        });

        const token = generateToken({ id: admin.id, email: admin.email, role: 'admin' });

        const adminResponse = { ...admin };
        delete adminResponse.password;

        return res.status(201).json({
            status: true,
            msg: "Admin registered successfully.",
            admin: adminResponse,
            token
        });
    } catch (error) {
        console.error("Register Admin Error:", error);
        return res.status(500).json({
            status: false,
            msg: error.message || "Internal server error occurred during admin registration"
        });
    }
};

/**
 * @Description Login Admin
 * @Route POST /api/admin/login
 * @Access Public
 */
export const loginAdmin = async (req, res) => {
    const payload = req.body;

    const result = LoginAdminSchema(payload);
    if (result.error) {
        return res.status(400).json({
            status: false,
            msg: result.error.message
        });
    }

    try {
        const admin = await prisma.admin.findUnique({
            where: { email: payload.email }
        });

        if (!admin) {
            return res.status(400).json({
                status: false,
                msg: "Admin not found"
            });
        }

        const isPasswordValid = await bcrypt.compare(payload.password, admin.password);
        if (!isPasswordValid) {
            return res.status(400).json({
                status: false,
                msg: "Invalid password"
            });
        }

        const token = generateToken({ id: admin.id, email: admin.email, role: 'admin' });

        const adminResponse = { ...admin };
        delete adminResponse.password;

        return res.status(200).json({
            status: true,
            msg: "Admin logged in successfully.",
            admin: adminResponse,
            token
        });
    } catch (error) {
        console.error("Login Admin Error:", error);
        return res.status(500).json({
            status: false,
            msg: error.message || "Internal server error occurred during admin login"
        });
    }
};

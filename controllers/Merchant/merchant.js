//NPM Packages
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

//Prisma Client
import { prisma } from "../../config/db.js";

//Schema 
import { RegisterSchema, LoginSchema } from "../../schema/Merchant/Merchant.js";
import { generateToken } from "../../utils/methods/Methods.js";


/**
 *  @Decription Register a merchant
 * @Route POST /api/merchant/register
 * @Access Public
 */
export const Register = async (req, res) => {
    const payload = req.body;

    const result = RegisterSchema(payload)
    if (result.error) {
        return res.status(400).json({
            status: false,
            msg: result.error.message
        })
    }
    try {
        const existingMerchant = await prisma.merchant.findUnique({
            where: {
                email: payload.email
            }
        })
        if (existingMerchant) {
            return res.status(400).json({
                status: false,
                msg: "Merchant already exists"
            })
        }

        const hashedPassword = await bcrypt.hash(payload.password, 10);

        const createMerchant = await prisma.merchant.create({
            data: {
                email: payload.email,
                password: hashedPassword,
                name: payload.name,
                businessName: payload.businessName,
                category: payload.category,
                address: payload.address,
                defaultRadiusMeter: payload.defaultRadiusMeter,
                phone: payload.phone,
                photoUrl: payload.photoUrl || ""
            }
        })

        const token = await generateToken(createMerchant.id);

        return res.status(201).json({
            status: true,
            msg: "Merchant registered successfully",
            merchant: createMerchant,
            token
        })
    } catch (error) {
        return res.status(500).json({
            status: false,
            msg: error.message
        })
    }
}

/**
 *  @Decription Login merchant
 * @Route POST /api/merchant/login
 * @Access Public
 */
export const Login = async (req, res) => {
    const payload = req.body;

    const result = LoginSchema(payload)
    if (result.error) {
        return res.status(400).json({
            status: false,
            msg: result.error.message
        })
    }
    try {
        const existingMerchant = await prisma.merchant.findUnique({
            where: {
                email: payload.email
            }
        })
        if (!existingMerchant) {
            return res.status(400).json({
                status: false,
                msg: "Merchant not found"
            })
        }

        const isPasswordValid = await bcrypt.compare(payload.password, existingMerchant.password);
        if (!isPasswordValid) {
            return res.status(400).json({
                status: false,
                msg: "Invalid password"
            })
        }

        const token = await generateToken(existingMerchant.id);

        return res.status(200).json({
            status: true,
            msg: "Login successful",
            token,
            merchant: existingMerchant
        })
    } catch (error) {
        return res.status(500).json({
            status: false,
            msg: error.message
        })
    }
}

/**
 *  @Decription Merchant Profile
 * @Route GET /api/merchant/whoami
 * @Access Private
 */
export const WhoAmI = async (req, res) => {
    const { id } = req.merchant;
    console.log(id)
    try {
        const merchant = await prisma.merchant.findUnique({
            where: {
                id
            }
        })

        return res.status(200).json({
            status: true,
            msg: "Merchant profile",
            merchant: merchant
        })
    } catch (error) {
        return res.status(500).json({
            status: false,
            msg: error.message
        })
    }
}


/**
 *  @Decription Get Merchant Credits
 * @Route GET /api/merchant/credits
 * @Access Private
 */
export const GetCredits = async (req, res) => {
    const { id } = req.merchant;

    try {
        const merchant = await prisma.merchant.findUnique({
            where: {
                id
            }
        })

        return res.status(200).json({
            status: true,
            msg: "Merchant credits",
            credits: merchant.credits
        })
    } catch (error) {
        return res.status(500).json({
            status: false,
            msg: error.message
        })
    }
}

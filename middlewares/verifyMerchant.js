import jwt from "jsonwebtoken";
import { prisma } from "../config/db.js";

export const verifyMerchant = async (req, res, next) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1];
    
      const decoded = jwt.verify(token.trim(), process.env.JWT_SECRET);

      const merchantId = decoded.id;
      const merchant = await prisma.merchant.findUnique({
        where: { id: merchantId }
      });

      if (merchant) {
        delete merchant.password;
        req.user = merchant; // Attaching to req.user so controllers work smoothly
      } else {
        return res.status(401).json({ status: false, msg: "Not authorized, merchant not found" });
      }

      return next();
    } catch (error) {
      console.error("Token Verification Error:", error.message);
      return res.status(401).json({ status: false, msg: "Not authorized, token failed" });
    }
  }

  if (!token) {
    return res.status(401).json({ status: false, msg: "Not authorized, no token" });
  }
};

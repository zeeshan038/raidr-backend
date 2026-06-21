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

      const merchantId = decoded.user || decoded.id;
      if (!merchantId) {
        return res.status(401).json({ status: false, msg: "Not authorized, invalid token payload" });
      }

      const merchant = await prisma.merchant.findUnique({
        where: { id: merchantId }
      });

      if (merchant) {
        delete merchant.password;
        req.user = merchant; // Attaching to req.user so some controllers work smoothly
        req.merchant = merchant; // Specifically attach to req.merchant for merchant routes
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

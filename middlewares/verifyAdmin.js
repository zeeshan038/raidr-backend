import jwt from "jsonwebtoken";
import { prisma } from "../config/db.js";

export const verifyAdmin = async (req, res, next) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1];
      const decoded = jwt.verify(token.trim(), process.env.JWT_SECRET);

      // The admin registration/login token payload wraps admin info inside 'user'
      const adminPayload = decoded.user;
      if (!adminPayload || adminPayload.role !== 'admin') {
        return res.status(403).json({ status: false, msg: "Access denied, admin role required" });
      }

      const admin = await prisma.admin.findUnique({
        where: { id: adminPayload.id }
      });

      if (admin) {
        delete admin.password;
        req.admin = admin; // Attach to req.admin
      } else {
        return res.status(401).json({ status: false, msg: "Not authorized, admin not found" });
      }

      return next();
    } catch (error) {
      console.error("Admin Token Verification Error:", error.message);
      return res.status(401).json({ status: false, msg: "Not authorized, token failed" });
    }
  }

  if (!token) {
    return res.status(401).json({ status: false, msg: "Not authorized, no token" });
  }
};

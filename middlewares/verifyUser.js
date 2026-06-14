import jwt from "jsonwebtoken";
import { prisma } from "../config/db.js";

export const verifyUser = async (req, res, next) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1];
      
      const decoded = jwt.verify(token.trim(), process.env.JWT_SECRET);
      
      const userId = decoded.user._id || decoded.user.id;

      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (user) {
        delete user.password;
        req.user = user;
      }

      if (!req.user) {
        return res.status(401).json({ status: false, msg: "Not authorized, user not found" });
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

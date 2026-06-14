import jwt from "jsonwebtoken";

export const generateToken = (user) => {
    return jwt.sign({ user }, process.env.JWT_SECRET);
};

export const generateOTP = async () => {
    const OTP = Math.floor(100000 + Math.random() * 900000);
    return OTP.toString();
};
// NPM packages
import bcrypt from "bcrypt";
import { getAuth } from "firebase-admin/auth";

// Prisma Client
import { prisma } from "../config/db.js";

//Schema
import {
    RegisterSchema,
    LoginSchema,
    UpdateSchema,
    ForgotPasswordSchema,
    ResetPasswordSchema
} from "../schema/User.js";

//Utils
import sendEmail from "../utils/Nodemailer.js";
import {
    generateOTP,
    generateToken
} from "../utils/methods/methods.js";


/**
 * @Description Register user  
 * @Route POST api/user/register
 * @Access Public
 */
export const registerUser = async (req, res) => {
    const payload = req.body;

    const result = RegisterSchema(payload)
    if (result.error) {
        return res.status(400).json({
            status: false,
            msg: result.error.message
        })
    }
    try {
        const existingUser = await prisma.user.findUnique({ where: { email: payload.email } });

        const hashedPassword = await bcrypt.hash(payload.password, 10);
        const otp = await generateOTP();
        const otpExpireTime = new Date(Date.now() + 10 * 60 * 1000);

        let user;

        if (existingUser) {
            if (existingUser.isVerified) {
                return res.status(400).json({
                    status: false,
                    msg: "User already exists"
                });
            } else {
                // User exists but is not verified yet, so we update their OTP and password instead of crashing
                user = await prisma.user.update({
                    where: { email: payload.email },
                    data: {
                        password: hashedPassword,
                        otpCode: otp,
                        otpCreatedAt: new Date(),
                        otpUpdatedAt: new Date(),
                        otpCodeExpireTime: otpExpireTime
                    }
                });
            }
        } else {
            // New User
            user = await prisma.user.create({
                data: {
                    name: payload.name,
                    email: payload.email,
                    password: hashedPassword,
                    isVerified: false,
                    otpCode: otp,
                    otpCreatedAt: new Date(),
                    otpUpdatedAt: new Date(),
                    otpCodeExpireTime: otpExpireTime
                }
            });
        }

        await sendEmail({
            to: payload.email,
            subject: "Your Registration OTP for Raidr",
            text: `Your OTP for Raidr registration is ${otp}. It will expire in 10 minutes.`
        });

        const token = generateToken(user);

        res.status(201).json({
            status: true,
            msg: "User registered successfully. Please verify your OTP to complete registration.",
            user: {
                _id: user.id,
                name: user.name,
                email: user.email,
                isVerified: user.isVerified
            },
            token
        })

    } catch (error) {
        res.status(500).json({
            status: false,
            msg: error.message
        })
    }
}

/**
 * @Description Login User
 * @Route POST api/user/login
 * @Access Public
 */
export const loginUser = async (req, res) => {
    const payload = req.body;
    const result = LoginSchema(payload)
    if (result.error) {
        return res.status(400).json({
            status: false,
            msg: result.error.message
        })
    }
    try {
        const user = await prisma.user.findUnique({ where: { email: payload.email } });
        if (!user) {
            return res.status(400).json({
                status: false,
                msg: "User not found"
            })
        }
        const isPasswordValid = await bcrypt.compare(payload.password, user.password)
        if (!isPasswordValid) {
            return res.status(400).json({
                status: false,
                msg: "Invalid password"
            })
        }

        // const otp = await generateOTP();
        // const otpExpireTime = new Date(Date.now() + 10 * 60 * 1000);

        // const updatedUser = await prisma.user.update({
        //     where: { id: user.id },
        //     data: {
        //         otpCode: otp,
        //         otpCreatedAt: new Date(),
        //         otpUpdatedAt: new Date(),
        //         otpCodeExpireTime: otpExpireTime
        //     }
        // });

        // await sendEmail({
        //     to: payload.email,
        //     subject: "Your Login OTP for Raidr",
        //     text: `Your OTP to login to Raidr is ${otp}. It will expire in 10 minutes.`
        // });

        const token = generateToken(user);

        const userResponse = { ...user, _id: user.id };
        delete userResponse.isNewUser;
        delete userResponse.password;
        delete userResponse.otpCode;
        delete userResponse.firebaseUid;
        delete userResponse.avatarUpdatedAt;
        delete userResponse.selectedAvatarId;
        delete userResponse.has_seen_level_welcome;
        delete userResponse.otpCreatedAt;
        delete userResponse.otpUpdatedAt;
        delete userResponse.otpCodeExpireTime;

        res.status(200).json({
            status: true,
            msg: "User logged in successfully.",
            user: userResponse,
            token
        })
    } catch (error) {
        res.status(500).json({
            status: false,
            msg: error.message
        })
    }
}

/**
 * @Description Send OTP
 * @Route POST api/user/send-otp
 * @Access Public
 */
export const sendOTP = async (req, res) => {
    const { email } = req.body;
    try {
        const user = await prisma.user.findUnique({ where: { email: email } });
        if (!user) {
            return res.status(400).json({
                status: false,
                msg: "User not found"
            })
        }
        const otp = await generateOTP();
        const otpExpireTime = new Date(Date.now() + 10 * 60 * 1000);

        const updatedUser = await prisma.user.update({
            where: { id: user.id },
            data: {
                otpCode: otp,
                otpCreatedAt: new Date(),
                otpUpdatedAt: new Date(),
                otpCodeExpireTime: otpExpireTime
            }
        });

        await sendEmail({
            to: email,
            subject: "Your OTP for Raidr",
            text: `Your OTP for Raidr is ${otp}. It will expire in 10 minutes.`
        });

        // Map to old Mongoose format for frontend compatibility
        const userResponse = {
            ...updatedUser,
            _id: updatedUser.id,
            otp: {
                otpCode: updatedUser.otpCode,
                createdAt: updatedUser.otpCreatedAt,
                updatedAt: updatedUser.otpUpdatedAt,
                codeExpireTime: updatedUser.otpCodeExpireTime
            }
        };
        delete userResponse.id;
        delete userResponse.isNewUser;
        delete userResponse.otpCode;
        delete userResponse.otpCreatedAt;
        delete userResponse.otpUpdatedAt;
        delete userResponse.otpCodeExpireTime;

        res.status(200).json({
            status: true,
            msg: "OTP sent successfully",
            user: userResponse,
            otp
        })
    } catch (error) {
        res.status(500).json({
            status: false,
            msg: error.message
        })
    }
}

/**
 * @Description Verify OTP
 * @Route POST api/user/verify-otp
 * @Access Public
 */
export const verifyOTP = async (req, res) => {
    const { email, otp } = req.body;
    try {
        const user = await prisma.user.findUnique({ where: { email: email } });
        if (!user) {
            return res.status(400).json({
                status: false,
                msg: "User not found"
            })
        }
        if (user.otpCode !== otp) {
            return res.status(400).json({
                status: false,
                msg: "Invalid OTP"
            })
        }
        if (user.otpCodeExpireTime < new Date()) {
            return res.status(400).json({
                status: false,
                msg: "OTP expired"
            })
        }

        const isFirstTimeLogin = !user.isVerified;

        const updatedUser = await prisma.user.update({
            where: { id: user.id },
            data: {
                isVerified: true,
                isNewUser: isFirstTimeLogin,
                otpCode: null,
                otpCreatedAt: null,
                otpUpdatedAt: null,
                otpCodeExpireTime: null
            }
        });

        // Use updatedUser to generate token
        const token = generateToken(updatedUser);

        const userResponse = {
            ...updatedUser,
            _id: updatedUser.id
        };
        delete userResponse.isNewUser;

        res.status(200).json({
            status: true,
            msg: "OTP verified successfully",
            user: userResponse,
            token
        })
    } catch (error) {
        res.status(500).json({
            status: false,
            msg: error.message
        })
    }
}

/** 
 * @Description Sign-in with google
 * @Route POST api/user/signin-with-google
 * @Access Public
 */
export const signInWithGoogle = async (req, res) => {
    const { firebaseToken } = req.body;

    if (!firebaseToken) {
        return res.status(400).json({
            status: false,
            msg: "Firebase token is required"
        });
    }
    try {
        // Decode the Firebase token
        const decodedToken = await getAuth().verifyIdToken(firebaseToken);
        const { uid, email, name, picture } = decodedToken;

        let user = await prisma.user.findUnique({ where: { email: email } });

        if (!user) {
            user = await prisma.user.create({
                data: {
                    email: email,
                    name: name || "Google User",
                    authProvider: "google",
                    firebaseUid: uid,
                    photoUrl: picture || "",
                    isVerified: true,
                    isNewUser: true
                }
            });
        } else {
            user = await prisma.user.update({
                where: { id: user.id },
                data: {
                    firebaseUid: uid,
                    photoUrl: user.photoUrl || picture,
                    isVerified: true,
                    isNewUser: false
                }
            });
        }

        const token = generateToken(user);

        const userResponse = {
            ...user,
            _id: user.id
        };

        res.status(200).json({
            status: true,
            msg: "User logged in with Google successfully",
            user: userResponse,
            token
        });
    } catch (error) {
        res.status(500).json({
            status: false,
            msg: error.message
        });
    }
}

/** 
 * @Description Sign-in with apple
 * @Route POST api/user/signin-with-apple
 * @Access Public
 */
export const signInWithApple = async (req, res) => {
    const { firebaseToken } = req.body;

    if (!firebaseToken) {
        return res.status(400).json({
            status: false,
            msg: "Firebase token is required"
        });
    }
    try {
        const decodedToken = await getAuth().verifyIdToken(firebaseToken);
        const { uid, email, name, picture } = decodedToken;

        let user = email
            ? await prisma.user.findUnique({ where: { email: email } })
            : await prisma.user.findUnique({ where: { firebaseUid: uid } });

        if (!user) {
            user = await prisma.user.create({
                data: {
                    email: email,
                    name: name || "Apple User",
                    authProvider: "apple",
                    firebaseUid: uid,
                    photoUrl: picture || "",
                    isVerified: true,
                    isNewUser: true
                }
            });
        } else {
            user = await prisma.user.update({
                where: { id: user.id },
                data: {
                    firebaseUid: uid,
                    photoUrl: user.photoUrl || picture,
                    isVerified: true,
                    isNewUser: false
                }
            });
        }

        const token = generateToken(user);

        const userResponse = {
            ...user,
            _id: user.id
        };

        res.status(200).json({
            status: true,
            msg: "User logged in with Apple successfully",
            user: userResponse,
            token
        });
    } catch (error) {
        res.status(500).json({
            status: false,
            msg: error.message
        });
    }
}

/**
 * @Description Get User Profile
 * @Route GET api/user/whoami
 * @Access Private
 */
export const getUserProfile = async (req, res) => {
    const { id } = req.user;
    try {
        const user = await prisma.user.findUnique({
            where: { id: id }
        });
        if (!user) {
            return res.status(404).json({
                status: false,
                msg: "User not found"
            });
        }

        const userResponse = { ...user, _id: user.id };
        delete userResponse.isNewUser;

        res.status(200).json({
            status: true,
            msg: "User profile fetched successfully",
            user: userResponse
        });
    } catch (error) {
        res.status(500).json({
            status: false,
            msg: error.message
        });
    }
}

/**
 * @Description Update User
 * @Route PUT api/user/update
 * @Access Private
 */
export const updateUser = async (req, res) => {
    const { id } = req.user;
    const payload = req.body;

    const { error } = UpdateSchema(payload);
    if (error) {
        return res.status(400).json({
            status: false,
            msg: error.message
        })
    }

    try {
        const existingUser = await prisma.user.findUnique({ where: { id: id } });
        if (!existingUser) {
            return res.status(404).json({
                status: false,
                msg: "User not found"
            });
        }
        const user = await prisma.user.update({
            where: { id: id },
            data: payload
        });

        const userResponse = { ...user, _id: user.id };
        delete userResponse.isNewUser;

        res.status(200).json({
            status: true,
            msg: "User updated successfully",
            user: userResponse
        });
    } catch (error) {
        res.status(500).json({
            status: false,
            msg: error.message
        });
    }
}

/**
 * @Description Update User Lat Long
 * @Route PUT api/user/update-location
 * @Access Private
 */
export const UpdateLocation = async (req, res) => {
    const { id } = req.user;
    const { lat, long } = req.body;
    if (!lat || !long) {
        return res.status(400).json({
            status: false,
            msg: "Lat and long are required"
        })
    }
    try {
        await prisma.user.update({
            where: { id: id },
            data: {
                lat: String(lat),
                long: String(long)
            }
        });
        res.status(200).json({
            status: true,
            msg: "User location updated successfully"
        });
    } catch (error) {
        res.status(500).json({
            status: false,
            msg: error.message
        });
    }
}

/**
 * @Description Update FCM
 * @Route PUT api/user/update-fcm
 * @Access Private
 */
export const UpdateFCM = async (req, res) => {
    const { id } = req.user;
    const { fcmToken } = req.body;

    if (!fcmToken) {
        return res.status(400).json({
            status: false,
            msg: "FCM token is required"
        });
    }

    try {
        await prisma.user.update({
            where: { id: id },
            data: {
                fcmToken: fcmToken
            }
        });
        res.status(200).json({
            status: true,
            msg: "User FCM updated successfully"
        });
    } catch (error) {
        res.status(500).json({
            status: false,
            msg: error.message
        });
    }
}

/**
 * @Description Detete User
 * @Route PUT api/user/delete
 * @Access Private
 */
export const deleteUser = async (req, res) => {
    const { id } = req.user;
    try {
        const existingUser = await prisma.user.findUnique({ where: { id: id } });
        if (!existingUser) {
            return res.status(404).json({
                status: false,
                msg: "User not found"
            });
        }
        const user = await prisma.user.delete({ where: { id: id } });

        const userResponse = { ...user, _id: user.id };
        delete userResponse.isNewUser;

        res.status(200).json({
            status: true,
            msg: "User deleted successfully",
            user: userResponse
        });
    } catch (error) {
        res.status(500).json({
            status: false,
            msg: error.message
        });
    }
}

/**
 * @Description Forgot Password
 * @Route POST api/user/forgot-password
 * @Access Public
 */
export const forgotPassword = async (req, res) => {
    const payload = req.body;
    const result = ForgotPasswordSchema(payload);
    if (result.error) {
        return res.status(400).json({
            status: false,
            msg: result.error.message
        });
    }
    try {
        const user = await prisma.user.findUnique({ where: { email: payload.email } });
        if (!user) {
            return res.status(400).json({
                status: false,
                msg: "User not found"
            });
        }

        const otp = await generateOTP();
        const otpExpireTime = new Date(Date.now() + 10 * 60 * 1000);

        await prisma.user.update({
            where: { id: user.id },
            data: {
                otpCode: otp,
                otpCreatedAt: new Date(),
                otpUpdatedAt: new Date(),
                otpCodeExpireTime: otpExpireTime
            }
        });

        await sendEmail({
            to: payload.email,
            subject: "Password Reset OTP for Raidr",
            text: `Your OTP to reset your Raidr password is ${otp}. It will expire in 10 minutes.`
        });

        res.status(200).json({
            status: true,
            msg: "Password reset OTP sent to email successfully."
        });
    } catch (error) {
        res.status(500).json({
            status: false,
            msg: error.message
        });
    }
};

/**
 * @Description Reset Password
 * @Route POST api/user/reset-password
 * @Access Public
 */
export const resetPassword = async (req, res) => {
    const payload = req.body;
    const result = ResetPasswordSchema(payload);
    if (result.error) {
        return res.status(400).json({
            status: false,
            msg: result.error.message
        });
    }
    try {
        const user = await prisma.user.findUnique({ where: { email: payload.email } });
        if (!user) {
            return res.status(400).json({
                status: false,
                msg: "User not found"
            });
        }

        const hashedPassword = await bcrypt.hash(payload.newPassword, 10);
        await prisma.user.update({
            where: { id: user.id },
            data: {
                password: hashedPassword,
                otpCode: null,
                otpCreatedAt: null,
                otpUpdatedAt: null,
                otpCodeExpireTime: null
            }
        });

        res.status(200).json({
            status: true,
            msg: "Password reset successfully"
        });
    } catch (error) {
        res.status(500).json({
            status: false,
            msg: error.message
        });
    }
};

/**
 * @Description Update Avatar Url 
 * @Route POST api/user/update-avatar
 * @Access Public
 */
export const updateAvatarUrl = async (req, res) => {
    const { id } = req.user;
    const { avatarFrontUrl, avatarBackUrl } = req.body;
    try {
        const user = await prisma.user.findUnique({ where: { id: id } });
        if (!user) {
            return res.status(404).json({
                status: false,
                msg: "User not found"
            });
        }
        const updatedUser = await prisma.user.update({
            where: { id: id },
            data: {
                avatarFrontUrl: avatarFrontUrl,
                avatarBackUrl: avatarBackUrl,
                avatarUpdatedAt: new Date()
            }
        });
        res.status(200).json({
            status: true,
            msg: "Avatar updated successfully",
            user: updatedUser
        });
    } catch (error) {
        res.status(500).json({
            status: false,
            msg: error.message
        });
    }
}


/**
 * @Description Get Avatars From DB  
 * @Route GET api/user/avatars
 * @Access Private
 */
export const getAvatars = async (req, res) => {
    const { id } = req.user;
    try {
        const user = await prisma.user.findUnique({ where: { id: id } });
        if (!user) {
            return res.status(404).json({
                status: false,
                msg: "User not found"
            });
        }
        const userLevel = user.level;
        const avatarsData = await prisma.avatar.findMany({
            orderBy: { avatarNumber: 'asc' }
        });

        const groupedAvatars = {};

        avatarsData.forEach(avatar => {
            const avatarKey = `avatar${avatar.avatarNumber}`;
            groupedAvatars[avatarKey] = {
                front: avatar.frontUrl,
                back: avatar.backUrl,
                locked: avatar.avatarNumber === 1 ? false : true
            };
        });

        res.status(200).json({
            status: true,
            msg: "Avatars fetched successfully",
            currentLevel: userLevel,
            avatars: groupedAvatars
        });
    } catch (error) {
        res.status(500).json({
            status: false,
            msg: error.message
        });
    }
}

/**
 * @Description Get All Keys i-e take out keys from the env file and send it at the api reponse
 * @Route POST api/user/get-keys
 * @Access Private
 */
export const getKeys = async (req, res) => {
    try {
        const allKeys = {
            googleApiKey: process.env.GOOGLE_PLACES_API_KEY,
            openWeatherApiKey: process.env.OPENWEATHER_API_KEY,
            openRouterApiKey: process.env.OPENROUTER_API_KEY,
            openAiApiKey: process.env.OPENAI_API_KEY,
            mapboxToken: process.env.MAPBOX_TOKEN
        };

        res.status(200).json({
            status: true,
            msg: "Keys fetched successfully",
            keys: allKeys
        });
    } catch (error) {
        res.status(500).json({
            status: false,
            msg: error.message
        });
    }
};


/**
 * @Description Get all boxes
 * @Route GET api/user/get-all-boxes
 * @Access Private
 */
export const getAllBoxes = async (req, res) => {
    const { id } = req.user;
    const { source } = req.query;
    try {
        const user = await prisma.user.findUnique({ where: { id: id } });
        if (!user) {
            return res.status(404).json({
                status: false,
                msg: "User not found"
            });
        }

        const whereClause = { userId: id };
        if (source) {
            whereClause.source = source;
        }

        const boxLogs = await prisma.boxCollectionLog.findMany({
            where: whereClause,
            orderBy: { createdAt: 'desc' }
        });

        const history = boxLogs;

        res.status(200).json({
            status: true,
            msg: "Box history fetched successfully",
            currentLevel: user.level,
            totalGreenBoxes: user.green_boxes_count,
            totalGoldenBoxes: user.golden_boxes_count,
            totalPurpleBoxes: user.purple_boxes_count,
            history: history
        });
    } catch (error) {
        res.status(500).json({
            status: false,
            msg: error.message
        });
    }
}


/**
 * @Description Get User Live Event Claims
 * @Route GET api/user/live-events/claims
 * @Access Private
 */
export const getUserLiveEventClaims = async (req, res) => {
    const { id } = req.user;
    try {
        const user = await prisma.user.findUnique({ where: { id: id } });
        if (!user) {
            return res.status(404).json({
                status: false,
                msg: "User not found"
            });
        }

        const liveEventLogs = await prisma.liveEventClaim.findMany({
            where: { userId: id },
            include: { event: true },
            orderBy: { claimedAt: 'desc' }
        });

        res.status(200).json({
            status: true,
            msg: "Live event claims fetched successfully",
            history: liveEventLogs
        });
    } catch (error) {
        res.status(500).json({
            status: false,
            msg: error.message
        });
    }
}

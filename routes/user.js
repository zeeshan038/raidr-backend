import express from 'express';
const router = express.Router();

//controllers
import {
    registerUser,
    loginUser,
    sendOTP,
    verifyOTP,
    signInWithGoogle,
    signInWithApple,
    updateUser,
    getUserProfile,
    deleteUser,
    forgotPassword,
    resetPassword,
    updateAvatarUrl,
    getAvatars,
    getKeys,
    UpdateLocation,
    UpdateFCM,
    agreeSafetyWarning
} from '../controllers/user.js';

//middlewares
import { verifyUser } from '../middlewares/verifyUser.js';

router.post('/register' , registerUser);
router.post('/login' , loginUser);
router.post('/send-otp' , sendOTP);
router.post('/verify-otp' , verifyOTP);
router.post('/signin-with-google' , signInWithGoogle);
router.post('/signin-with-apple' , signInWithApple);
router.post('/forgot-password' , forgotPassword);
router.post('/reset-password' , resetPassword);

router.use(verifyUser);
router.get('/avatars' , getAvatars);
router.put('/update' , updateUser);
router.get('/whoami' , getUserProfile);
router.delete('/delete' , deleteUser);
router.patch('/update-photo-url' , updateAvatarUrl);
router.get('/get-all-keys' , getKeys);
router.patch("/update-location",UpdateLocation);
router.patch('/update-fcm' , UpdateFCM);
router.post('/agree-safety', agreeSafetyWarning);

export default router;
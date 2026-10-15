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
    // getKeys,
    UpdateLocation,
    UpdateFCM,
    agreeSafetyWarning,
    getProfilePreferenceOptions,
    saveProfilePreferences,
    updateProfilePreferences,
    searchLocation,
} from '../controllers/user.js';
import {
    getNotificationPreferences,
    updateNotificationPreferences,
} from '../controllers/userNotificationPreferences.js';
 
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
router.post('/search-location', searchLocation);

router.use(verifyUser);
router.get('/avatars' , getAvatars);
router.put('/update' , updateUser);
router.get('/whoami' , getUserProfile);
router.delete('/delete' , deleteUser);
router.patch('/update-photo-url' , updateAvatarUrl);
// router.get('/get-all-keys' , getKeys);
router.patch("/update-location",UpdateLocation);
router.patch('/update-fcm' , UpdateFCM);
router.post('/agree-safety', agreeSafetyWarning);
router.get('/notification-preferences', getNotificationPreferences);
router.patch('/notification-preferences', updateNotificationPreferences);
router.get('/profile-preferences/options', getProfilePreferenceOptions);
router.post('/profile-preferences', saveProfilePreferences);
router.post('/update-profile-preferences', updateProfilePreferences);

export default router;
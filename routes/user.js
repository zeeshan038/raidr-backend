import express from 'express';
const router = express.Router();

//controllers
import {
    registerUser,
    loginUser,
    sendOTP,
    verifyOTP,
    signInWithGoogle,
    updateUser,
    getUserProfile,
    deleteUser,
    forgotPassword,
    resetPassword,
    updateAvatarUrl,
    getAvatars
} from '../controllers/user.js';

//middlewares
import { verifyUser } from '../middlewares/verifyUser.js';

router.post('/register' , registerUser);
router.post('/login' , loginUser);
router.post('/send-otp' , sendOTP);
router.post('/verify-otp' , verifyOTP);
router.post('/signin-with-google' , signInWithGoogle);
router.post('/forgot-password' , forgotPassword);
router.post('/reset-password' , resetPassword);

router.use(verifyUser);
router.get('/avatars' , getAvatars);
router.put('/update' , updateUser);
router.get('/whoami' , getUserProfile);
router.delete('/delete' , deleteUser);
router.patch('/update-photo-url' , updateAvatarUrl);
 
export default router;
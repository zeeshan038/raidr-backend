import express from 'express';
const router = express.Router();

import { testPushNotification, testEmailNotification } from '../controllers/test.js';

router.post('/push-notification', testPushNotification);
router.post('/email-notification', testEmailNotification);

export default router;

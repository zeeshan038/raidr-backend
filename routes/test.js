import express from 'express';
const router = express.Router();

import {
  testPushNotification,
  testEmailNotification,
  listPushNavigationTypes,
  testPushNavigation,
} from '../controllers/test.js';

router.get('/push-navigation/types', listPushNavigationTypes);
router.post('/push-navigation', testPushNavigation);
router.post('/push-notification', testPushNotification);
router.post('/email-notification', testEmailNotification);

export default router;

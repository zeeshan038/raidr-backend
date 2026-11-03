import { sendNotification } from "../utils/Notification.js";
import { buildPushData, PUSH_TYPE } from "../utils/pushNotificationPayload.js";
import {
  buildPushNavigationTestPayload,
  isPushNavigationTestAllowed,
  listPushNavigationTestTypes,
  PUSH_NAV_PLACEHOLDER_IDS,
} from "../utils/pushNavigationTest.js";
import sendEmail from "../utils/Nodemailer.js";

const pushTestForbidden = (res) =>
  res.status(403).json({
    success: false,
    message:
      "Push navigation test is disabled. Set PUSH_NAV_TEST_SECRET and pass it as body.secret or header x-push-test-secret.",
  });

export const testPushNotification = async (req, res) => {
  try {
    if (!isPushNavigationTestAllowed(req)) return pushTestForbidden(res);

    const { fcmToken, title, body } = req.body;
    if (!fcmToken) {
      return res.status(400).json({ success: false, message: "fcmToken is required in the request body" });
    }

    await sendNotification(
      fcmToken,
      title || "Test Notification",
      body || "This is a test push notification from the backend.",
      buildPushData({ type: PUSH_TYPE.TEST })
    );

    res.status(200).json({ success: true, message: "Push notification sent successfully" });
  } catch (error) {
    console.error("Error in testPushNotification:", error);
    res.status(500).json({ success: false, message: "Failed to send push notification", error: error.message });
  }
};

/**
 * @Description List all push navigation test cases (type, category, required IDs)
 * @Route GET /api/test/push-navigation/types
 */
export const listPushNavigationTypes = async (req, res) => {
  if (!isPushNavigationTestAllowed(req)) return pushTestForbidden(res);

  res.status(200).json({
    success: true,
    data: listPushNavigationTestTypes(),
    placeholderIds: PUSH_NAV_PLACEHOLDER_IDS,
    hint: "POST /api/test/push-navigation with fcmToken + type (+ optional real IDs).",
  });
};

/**
 * @Description Send a push with full FCM data payload for navigation testing
 * @Route POST /api/test/push-navigation
 */
export const testPushNavigation = async (req, res) => {
  try {
    if (!isPushNavigationTestAllowed(req)) return pushTestForbidden(res);

    const { fcmToken, type, title, body, ...idOverrides } = req.body;

    if (!fcmToken) {
      return res.status(400).json({ success: false, message: "fcmToken is required" });
    }
    if (!type) {
      return res.status(400).json({
        success: false,
        message: "type is required (see GET /test/push-navigation/types)",
      });
    }

    const built = buildPushNavigationTestPayload(type, {
      title,
      body,
      ...idOverrides,
    });

    if (built.error) {
      return res.status(400).json({ success: false, message: built.error });
    }

    await sendNotification(fcmToken, built.title, built.body, built.data);

    res.status(200).json({
      success: true,
      message: "Navigation test push sent",
      sent: {
        title: built.title,
        body: built.body,
        data: built.data,
      },
    });
  } catch (error) {
    console.error("Error in testPushNavigation:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send navigation test push",
      error: error.message,
    });
  }
};

export const testEmailNotification = async (req, res) => {
  try {
    const { email, subject, text } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: "email is required in the request body" });
    }

    await sendEmail({
      to: email,
      subject: subject || "Test Email",
      text: text || "This is a test email from the backend.",
      html: `<p>${text || "This is a test email from the backend."}</p>`,
    });

    res.status(200).json({ success: true, message: "Email sent successfully" });
  } catch (error) {
    console.error("Error in testEmailNotification:", error);
    res.status(500).json({ success: false, message: "Failed to send email", error: error.message });
  }
};

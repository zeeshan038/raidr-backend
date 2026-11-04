import { getMessaging } from "firebase-admin/messaging";

/**
 * @param {Record<string, string>} [data] FCM data payload (deep link); values must be strings.
 */
export const sendNotification = async (fcm, title, body, data) => {
  if (!fcm || typeof fcm !== "string") {
    console.error("Invalid FCM token");
    throw new Error("Invalid FCM token");
  }

  const message = {
    tokens: [fcm],
    notification: {
      title,
      body,
    },
    apns: {
      headers: {
        "apns-push-type": "alert",
      },
      payload: {
        aps: {
          badge: 1,
          sound: "default",
        },
      },
    },
  };

  if (data && Object.keys(data).length > 0) {
    message.data = data;
  }

  try {
    const response = await getMessaging().sendEachForMulticast(message);

    if (response.failureCount > 0) {
      console.error("Notification failed:", response.responses[0].error);
      throw new Error(`Notification failed: ${response.responses[0].error.message}`);
    } else {
      console.log("Notification sent successfully. Message ID:", response.responses[0].messageId);
    }
  } catch (error) {
    console.error("Error sending notification: ", error);
    throw error;
  }
};

export const verifyFCMToken = async (fcm) => {
  try {
    await getMessaging().send({ token: fcm }, true);
    return true;
  } catch (err) {
    console.log("Invalid Token", err);
    return false;
  }
};

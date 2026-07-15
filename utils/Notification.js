import { getMessaging } from "firebase-admin/messaging";

export const sendNotification = async (fcm, title, body) => {
  if (!fcm || typeof fcm !== "string") {
    console.error("Invalid FCM token");
    throw new Error("Invalid FCM token");
  }

  try {
    await getMessaging().sendEachForMulticast({
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
      }
    });
    console.log("Notification sent successfully.");
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

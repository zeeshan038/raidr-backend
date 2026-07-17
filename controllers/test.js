import { sendNotification } from "../utils/Notification.js";
import sendEmail from "../utils/Nodemailer.js";

export const testPushNotification = async (req, res) => {
    try {
        const { fcmToken, title, body } = req.body;
        if (!fcmToken) {
            return res.status(400).json({ success: false, message: "fcmToken is required in the request body" });
        }
        
        await sendNotification(fcmToken, title || "Test Notification", body || "This is a test push notification from the backend.");
        
        res.status(200).json({ success: true, message: "Push notification sent successfully" });
    } catch (error) {
        console.error("Error in testPushNotification:", error);
        res.status(500).json({ success: false, message: "Failed to send push notification", error: error.message });
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
            html: `<p>${text || "This is a test email from the backend."}</p>`
        });
        
        res.status(200).json({ success: true, message: "Email sent successfully" });
    } catch (error) {
        console.error("Error in testEmailNotification:", error);
        res.status(500).json({ success: false, message: "Failed to send email", error: error.message });
    }
};

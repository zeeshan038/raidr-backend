import express from "express";
import ConnectDB from "./config/db.js";
import cors from "cors";
import Routes from "./routes/index.js";
import { startCleanupCron } from "./cron/cleanupTrips.js";
import { startEventStatusCron } from "./cron/Events.js";
import "./config/firebase.js";
import swaggerUi from "swagger-ui-express";
import fs from "fs";
import dotenv from "dotenv";


// Reload
dotenv.config();
const app = express();
const allowedOrigins = [
  "http://localhost:5174",
  "http://localhost:5173",
  "https://business.raidr-app.com",
  "https://admin.raidr-app.com"
];

app.use(cors({
  origin: allowedOrigins
}));

app.use(express.json({
  verify: (req, res, buf) => {
    if (req.originalUrl && req.originalUrl.startsWith('/api/merchant/payments/webhook')) {
      console.log("webhook starting",req.originalUrl)
      req.rawBody = buf;
    }
  }
}));

ConnectDB();
startCleanupCron();
startEventStatusCron();

// Start Live Tracking architecture (Wrapped in try/catch in case dependencies aren't installed yet)
const initializeLiveTracking = async () => {
    try {
        const { startWebSocketServer } = await import("./sockets/liveTracking.js");
        const { startGpsWorker } = await import("./workers/gpsWorker.js");
        startWebSocketServer();
        startGpsWorker();
    } catch (err) {
        console.log('[App] Scalable live tracking architecture failed to start. Error:', err);
    }
};
initializeLiveTracking();

// Read the swagger.json file
const swaggerDocument = JSON.parse(fs.readFileSync('./swagger.json', 'utf8'));

// Serve raw JSON for the mobile dev
app.get('/swagger.json', (req, res) => {
  res.json(swaggerDocument);
});

// Serve Swagger UI and display the JSON URL at the top
const swaggerOptions = {
  swaggerOptions: {
    url: '/swagger.json'
  }
};
app.use('/swagger', swaggerUi.serve, swaggerUi.setup(null, swaggerOptions));

app.use("/api",Routes);

app.get("/check-server",(req,res)=>{
  res.send("OK");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Your app is running on PORT ${PORT}`);
});
 
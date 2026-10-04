import express from "express";
import ConnectDB from "./config/db.js";
import cors from "cors";
import Routes from "./routes/index.js";
import { startCleanupCron } from "./cron/cleanupTrips.js";
import { startEventStatusCron } from "./cron/Events.js";
import { startPassiveCoinsCron } from "./cron/passiveCoins.js";
import { startResetZonesCron } from "./cron/resetZones.js";
import "./config/firebase.js";
import swaggerUi from "swagger-ui-express";
import fs from "fs";
import dotenv from "dotenv";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import hpp from "hpp";
 

// Reload
dotenv.config();
const app = express();
const allowedOrigins = [
  "http://localhost:5174",
  "http://localhost:5173",
  "https://business.raidr-app.com",
  "https://admin.raidr-app.com",
  "https://dev.business.raidr-app.com",
  "https://dev.admin.raidr-app.com"
];

app.use(cors({
  origin: allowedOrigins
}));

// Security Middlewares
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(hpp());

// Trust the reverse proxy (like Cloudflare, NGINX, or a Load Balancer)
// This ensures rate limits apply to the actual user's IP instead of the proxy's IP.
app.set('trust proxy', 1);

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // limit each IP to 200 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api', limiter);


app.use(express.json({
  verify: (req, res, buf) => {
    if (req.originalUrl && req.originalUrl.startsWith('/api/merchant/payments/webhook')) {
      console.log("webhook starting", req.originalUrl)
      req.rawBody = buf;
    }
  }
}));

ConnectDB();
startCleanupCron();
startEventStatusCron();
startPassiveCoinsCron();
startResetZonesCron();

// Live tracking / WebSockets — isolated so a uWS failure cannot take down HTTP API
const initializeLiveTracking = async () => {
  try {
    const { startWebSocketServer } = await import("./sockets/liveTracking.js");
    startWebSocketServer();
  } catch (err) {
    console.error("[App] WebSocket server failed to start:", err?.message || err);
  }

  try {
    const { startGpsWorker } = await import("./workers/gpsWorker.js");
    startGpsWorker();
  } catch (err) {
    console.error("[App] GPS worker failed to start:", err?.message || err);
  }
};
void initializeLiveTracking().catch((err) => {
  console.error("[App] Live tracking init error:", err?.message || err);
});

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

app.use("/api", Routes);

app.get("/check-server", (req, res) => {
  res.send("OK");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Your app is running on PORT ${PORT}`);
});

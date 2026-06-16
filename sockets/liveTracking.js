import uWS from 'uWebSockets.js';
import jwt from 'jsonwebtoken';
import { redis } from '../services/redis.js';
import { Queue } from 'bullmq';
import dotenv from 'dotenv';
dotenv.config();

// Create a queue producer
let gpsQueue = null;

const WS_PORT = parseInt(process.env.WS_PORT) || 3001;

export const startWebSocketServer = () => {
    gpsQueue = new Queue('gps_events_queue', { connection: redis });

    const app = uWS.App().ws('/live-tracking', {
        compression: uWS.SHARED_COMPRESSOR,
        maxPayloadLength: 16 * 1024 * 1024,
        idleTimeout: 60,

        /* Handshake phase (authenticate user via query param) */
        upgrade: (res, req, context) => {
            const token = req.getQuery('token');
            const squadId = req.getQuery('squadId'); // Optional squad channel
            
            let isAborted = false;
            res.onAborted(() => { isAborted = true; });

            try {
                if (!token) throw new Error('No token provided');
                
                // Verify JWT token
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                
                if (!isAborted) {
                    res.upgrade(
                        { userId: decoded.id, squadId },
                        req.getHeader('sec-websocket-key'),
                        req.getHeader('sec-websocket-protocol'),
                        req.getHeader('sec-websocket-extensions'),
                        context
                    );
                }
            } catch (error) {
                if (!isAborted) {
                    res.writeStatus('401 Unauthorized').end('Invalid token');
                }
            }
        },

        /* On connection */
        open: (ws) => {
            console.log(`[uWS] User ${ws.userId} connected to live tracking`);
            // If they are in a squad, subscribe them to their squad's Redis channel
            if (ws.squadId) {
                ws.subscribe(`squad:${ws.squadId}`);
            }
        },

        /* On message received */
        message: async (ws, message, isBinary) => {
            try {
                // Parse the GPS payload: { tripId, lat, lng, heading }
                const payload = JSON.parse(Buffer.from(message).toString());
                payload.userId = ws.userId;

                // 1. Hot GPS: Write to Redis instantly (expires in 60s)
                await redis.set(`user:${ws.userId}:gps`, JSON.stringify(payload), 'EX', 60);

                // 2. Pub/Sub: Broadcast to squad members instantly
                if (ws.squadId) {
                    app.publish(`squad:${ws.squadId}`, JSON.stringify(payload));
                }

                // 3. Batch Writer: Add to BullMQ queue for Postgres bulk update
                if (payload.tripId && payload.lat && payload.lng) {
                    gpsQueue.add('gps_update', {
                        trips: [{ 
                            tripId: payload.tripId, 
                            lat: payload.lat, 
                            lng: payload.lng, 
                            heading: payload.heading 
                        }]
                    }, {
                        removeOnComplete: true,
                        removeOnFail: 100
                    });
                }
            } catch (error) {
                console.error('[uWS] Message error:', error.message);
            }
        },

        /* On closure */
        close: (ws, code, message) => {
            console.log(`[uWS] User ${ws.userId} disconnected`);
        }
    });

    app.listen(WS_PORT, (token) => {
        if (token) {
            console.log(`[uWS] Live Tracking WebSocket server listening on port ${WS_PORT}`);
        } else {
            console.error(`[uWS] Failed to listen to port ${WS_PORT}`);
        }
    });
};

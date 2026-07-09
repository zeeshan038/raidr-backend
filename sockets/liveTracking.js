//NPM Packages
import uWS from 'uWebSockets.js';
import jwt from 'jsonwebtoken';
import { Queue } from 'bullmq';
import dotenv from 'dotenv';
dotenv.config();

//Service
import { redis } from '../services/redis.js';
import { prisma } from '../config/db.js';

// Socket Modules
import { registerUWSApp } from './eventPublisher.js';
import { handleJoinEventRoom, handlePlayerLocationUpdate } from './handlers/eventHandler.js';


// Create a queue producer
let gpsQueue = null;

const WS_PORT = parseInt(process.env.WS_PORT) || 3001;

export const startWebSocketServer = () => {
    gpsQueue = new Queue('gps_events_queue', { connection: redis });

    const app = uWS.App();

    // Register the uWS app instance with the event publisher so
    // REST controllers (e.g. claimLiveEventReward) can call
    // publishToEvent() without needing to import uWS directly.
    registerUWSApp(app);

    app.ws('/live-tracking', {
        compression: uWS.SHARED_COMPRESSOR,
        maxPayloadLength: 16 * 1024 * 1024,
        idleTimeout: 60,

        upgrade: (res, req, context) => {
            const token = req.getQuery('token');
            const squadId = req.getQuery('squadId');

            let isAborted = false;
            res.onAborted(() => { isAborted = true; });

            try {
                if (!token) throw new Error('No token provided');
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                
                if (!isAborted) {
                    res.upgrade(
                        { userId: decoded.user?.id || decoded.user?._id || decoded.id, squadId },
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
            if (ws.squadId) {
                ws.subscribe(`squad:${ws.squadId}`);
            }
        },

        // On message received 
        message: async (ws, message, isBinary) => {
            try {
                const payload = JSON.parse(Buffer.from(message).toString());
                payload.userId = ws.userId;

                // ── Live Event Room ───────────────────────────────────────
                // When the mobile app opens an event screen it sends this
                // payload to subscribe to real-time event broadcasts.
                if (payload.type === 'join_event') {
                    await handleJoinEventRoom(ws, payload);
                    return;
                }

                // ── Player location for event map ─────────────────────────
                if (payload.type === 'player_location') {
                    handlePlayerLocationUpdate(ws, payload);
                    return;
                }
                // ─────────────────────────────────────────────────────────

                console.log(`[uWS] GPS received: lat=${payload.lat}, lng=${payload.lng}`);

                if (payload.type === 'box_collected') {
                    gpsQueue.add('box_collected', {
                        userId: ws.userId,
                        boxType: payload.boxType,
                        xpAmount: payload.xpAmount,
                        distanceCoveredKm: payload.distanceCoveredKm || 0,
                        source: payload.source,
                        lat: payload.lat,
                        lng: payload.lng,
                        adData: payload.ad
                    }, {
                        removeOnComplete: true,
                        removeOnFail: 100
                    });

                    // Mark the point as achieved in the trip
                    const { tripId, date, index } = payload;
                    if (tripId && index !== undefined) {
                        try {
                            const trip = await prisma.trip.findFirst({
                                where: { id: tripId, userId: ws.userId }
                            });

                            if (trip && trip.routesByDate) {
                                let routesByDate = trip.routesByDate;
                                if (typeof routesByDate === 'string') {
                                    routesByDate = JSON.parse(routesByDate);
                                }

                                let updated = false;

                                if (date && routesByDate[date]) {
                                    const stops = routesByDate[date];
                                    if (Array.isArray(stops)) {
                                        for (let i = 0; i < stops.length; i++) {
                                            if (String(stops[i].index) === String(index)) {
                                                stops[i].isAchieved = true;
                                                updated = true;
                                            }
                                        }
                                    }
                                } else {
                                    // Search all dates if no date parameter is supplied
                                    for (const key of Object.keys(routesByDate)) {
                                        const stops = routesByDate[key];
                                        if (Array.isArray(stops)) {
                                            for (let i = 0; i < stops.length; i++) {
                                                if (String(stops[i].index) === String(index)) {
                                                    stops[i].isAchieved = true;
                                                    updated = true;
                                                }
                                            }
                                        }
                                    }
                                }

                                if (updated) {
                                    await prisma.trip.update({
                                        where: { id: tripId },
                                        data: {
                                            routesByDate: routesByDate
                                        }
                                    });
                                    console.log(`[uWS] Marked stop index ${index} for trip ${tripId} as achieved.`);
                                }
                            }
                        } catch (dbErr) {
                            console.error('[uWS] Database error marking stop achieved:', dbErr.message);
                        }
                    }
                    return;
                }
 
                // Handle Distance Sync Events
                if (payload.type === 'sync_distance') {
                    if (payload.distanceCoveredKm > 0) {
                        gpsQueue.add('sync_distance', {
                            userId: ws.userId,
                            distanceCoveredKm: payload.distanceCoveredKm
                        }, {
                            removeOnComplete: true,
                            removeOnFail: 100
                        });
                    }
                    return; 
                }

                //  Hot GPS: Write to Redis instantly (expires in 60s)
                await redis.set(`user:${ws.userId}:gps`, JSON.stringify(payload), 'EX', 60);

                //  Pub/Sub: Broadcast to squad members instantly
                if (ws.squadId) {
                    app.publish(`squad:${ws.squadId}`, JSON.stringify(payload));
                }

                //  Batch Writer: Push to Redis List for the 10-second cron job
                if (payload.tripId && payload.lat && payload.lng) {
                    const batchItem = {
                        tripId: payload.tripId,
                        lat: payload.lat,
                        lng: payload.lng,
                        heading: payload.heading
                    };
                    await redis.rpush('gps_batch_list', JSON.stringify(batchItem));
                }
            } catch (error) {
                console.error('[uWS] Message error:', error.message);
            }
        },

        // On closure 
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

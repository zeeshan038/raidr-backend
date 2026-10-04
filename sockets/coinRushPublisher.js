/**
 * coinRushPublisher.js
 * 
 * Holds a reference to the uWebSockets.js `app` instance and
 * exposes clean helper functions for Coin Rush real-time events.
 */

let uwsApp = null;

/**
 * Called once from liveTracking.js after the uWS app is created.
 * @param {import('uWebSockets.js').TemplatedApp} app
 */
export const registerUWSAppForCoinRush = (app) => {
    uwsApp = app;
};

import { redis } from '../services/redis.js';

export const publishToCoinRush = (eventId, payload) => {
    payload.eventId = eventId;
    const topic = `coinrush:${eventId}`;
    
    redis.publish('ws_broadcast', JSON.stringify({ topic, payload }));
};

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

/**
 * Publish any payload to a specific Coin Rush event's topic.
 * All subscribers of `coinrush:<eventId>` will receive the message.
 * 
 * @param {string} eventId
 * @param {object} payload
 */
export const publishToCoinRush = (eventId, payload) => {
    if (!uwsApp) {
        console.warn('[CoinRushPublisher] uWS app not registered yet. Cannot publish.');
        return;
    }
    const topic = `coinrush:${eventId}`;
    uwsApp.publish(topic, JSON.stringify(payload));
};

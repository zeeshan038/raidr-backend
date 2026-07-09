/**
 * eventPublisher.js
 * 
 * Holds a reference to the uWebSockets.js `app` instance and
 * exposes clean helper functions so REST controllers can publish
 * real-time events into any event room without importing uWS directly.
 */

let uwsApp = null;

/**
 * Called once from liveTracking.js after the uWS app is created.
 * @param {import('uWebSockets.js').TemplatedApp} app
 */
export const registerUWSApp = (app) => {
    uwsApp = app;
};

/**
 * Publish any payload to a specific live event's topic.
 * All subscribers of `event:<eventId>` will receive the message.
 * 
 * @param {string} eventId
 * @param {object} payload
 */
export const publishToEvent = (eventId, payload) => {
    if (!uwsApp) {
        console.warn('[EventPublisher] uWS app not registered yet. Cannot publish.');
        return;
    }
    const topic = `event:${eventId}`;
    uwsApp.publish(topic, JSON.stringify(payload));
};

// ─── Convenience Publishers ──────────────────────────────────────────────────

/**
 * Broadcast that a new participant joined.
 * @param {string} eventId
 * @param {number} totalParticipants - updated count from DB
 */
export const publishParticipantJoined = (eventId, totalParticipants) => {
    publishToEvent(eventId, {
        type: 'participant_joined',
        totalParticipants
    });
};

/**
 * Broadcast updated inventory after a reward is claimed.
 * @param {string} eventId
 * @param {number} remainingQty
 */
export const publishInventoryUpdated = (eventId, remainingQty) => {
    publishToEvent(eventId, {
        type: 'inventory_updated',
        remainingQty
    });
};

/**
 * Broadcast a commander message to everyone in the event room.
 * @param {string} eventId
 * @param {string} text
 * @param {'system'|'merchant'} sender
 */
export const publishCommanderMessage = (eventId, text, sender = 'system') => {
    publishToEvent(eventId, {
        type: 'commander_message',
        text,
        sender
    });
};

/**
 * Broadcast that the event status changed (e.g. live, completed).
 * @param {string} eventId
 * @param {'live'|'completed'|'cancelled'} status
 */
export const publishEventStatusChanged = (eventId, status) => {
    publishToEvent(eventId, {
        type: 'event_status_changed',
        status
    });
};

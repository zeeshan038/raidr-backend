/**
 * eventHandler.js
 * 
 * Handles all incoming WebSocket messages of type 'join_event'.
 * When a user opens the Live Event Screen, the mobile app sends
 * this message so we subscribe their socket to the event's Pub/Sub topic.
 * 
 * Usage: called from liveTracking.js inside the `message` handler.
 */

import { prisma } from '../../config/db.js';
import { publishToEvent } from '../eventPublisher.js';

/**
 * Subscribe the connected socket to the live event topic and
 * immediately send back the current event snapshot (inventory,
 * participant count, status) so the mobile app doesn't need a
 * separate REST call just to bootstrap the screen.
 * 
 * @param {import('uWebSockets.js').WebSocket} ws - the connected socket
 * @param {object} payload - parsed incoming message
 * @param {string} payload.eventId
 */
export const handleJoinEventRoom = async (ws, payload) => {
    const { eventId } = payload;

    if (!eventId) {
        ws.send(JSON.stringify({
            type: 'error',
            msg: 'eventId is required to join an event room'
        }));
        return;
    }

    const topic = `event:${eventId}`;

    // Subscribe this socket to the event topic (uWS Pub/Sub)
    ws.subscribe(topic);

    console.log(`[EventHandler] User ${ws.userId} subscribed to ${topic}`);

    try {
        // Fetch a lightweight snapshot of the event so the app can
        // immediately render the correct UI state after connecting
        const event = await prisma.liveEvent.findUnique({
            where: { id: eventId },
            select: {
                id: true,
                title: true,
                status: true,
                remainingQty: true,
                rewardQuantity: true,
                endTime: true,
                _count: {
                    select: { participants: true }
                }
            }
        });

        if (!event) {
            ws.send(JSON.stringify({
                type: 'error',
                msg: 'Live event not found'
            }));
            return;
        }

        // Send the initial snapshot directly back to this one user (not broadcast)
        ws.send(JSON.stringify({
            type: 'event_snapshot',
            eventId: event.id,
            title: event.title,
            status: event.status,
            remainingQty: event.remainingQty,
            rewardQuantity: event.rewardQuantity,
            totalParticipants: event._count.participants,
            endTime: event.endTime
        }));

    } catch (err) {
        console.error('[EventHandler] Failed to fetch event snapshot:', err.message);
        ws.send(JSON.stringify({
            type: 'error',
            msg: 'Failed to load event data'
        }));
    }
};

/**
 * Broadcast this player's current GPS coordinates to everyone
 * else in the event room so the live map can show all players.
 * 
 * Throttling is done on the client side (only sent every 5 seconds
 * or when the user moves > 10 metres) to avoid flooding the server.
 * 
 * @param {import('uWebSockets.js').WebSocket} ws
 * @param {object} payload
 * @param {string} payload.eventId
 * @param {number} payload.lat
 * @param {number} payload.lng
 * @param {string} [payload.avatarUrl]
 */
export const handlePlayerLocationUpdate = (ws, payload) => {
    const { eventId, lat, lng, avatarUrl } = payload;

    if (!eventId || lat === undefined || lng === undefined) return;

    publishToEvent(eventId, {
        type: 'player_location',
        userId: ws.userId,
        lat,
        lng,
        avatarUrl: avatarUrl || null
    });
};

/**
 * Check if the live event has stock. If empty, automatically award the event XP.
 * 
 * @param {import('uWebSockets.js').WebSocket} ws
 * @param {object} payload
 * @param {string} payload.eventId
 * @param {number} [payload.lat]
 * @param {number} [payload.lng]
 */
export const handleCheckEventAvailability = async (ws, payload) => {
    const { eventId, lat, lng } = payload;
    const userId = ws.userId;
    console.log(`[EventHandler] Check availability requested for event: ${eventId} by user: ${userId}`);

    if (!eventId) {
        ws.send(JSON.stringify({ type: 'error', msg: 'eventId is required' }));
        return;
    }

    try {
        const event = await prisma.liveEvent.findUnique({
            where: { id: eventId }
        });

        if (!event) {
            console.log(`[EventHandler] -> Event ${eventId} not found`);
            ws.send(JSON.stringify({ type: 'error', msg: 'Event not found' }));
            return;
        }

        console.log(`[EventHandler] Event found: ${event.title}. Remaining Qty: ${event.remainingQty}`);

        if (event.remainingQty > 0) {
            console.log('[EventHandler] -> Event has stock. Sending status: available');
            ws.send(JSON.stringify({
                type: 'event_availability_response',
                status: 'available'
            }));
            return;
        }

        // Remaining Qty is <= 0. Give consolation XP if not already claimed.
        console.log('[EventHandler] -> Event is sold out. Checking existing claims for user...');
        const existingClaim = await prisma.liveEventClaim.findUnique({
            where: {
                eventId_userId: { eventId, userId }
            }
        });

        if (existingClaim) {
            console.log('[EventHandler] -> User has already claimed/received XP. Sending status: sold_out');
            ws.send(JSON.stringify({
                type: 'event_availability_response',
                status: 'sold_out',
                msg: 'Already claimed'
            }));
            return;
        }

        const xpAwarded = event.xpReward || 0;
        console.log(`[EventHandler] -> User has not claimed. Awarding ${xpAwarded} consolation XP...`);

        await prisma.$transaction([
            prisma.liveEventClaim.create({
                data: {
                    eventId,
                    userId,
                    code: 'CONSOLATION_XP',
                    xpEarned: xpAwarded,
                    lat: lat !== undefined ? parseFloat(lat) : null,
                    lng: lng !== undefined ? parseFloat(lng) : null
                }
            }),
            prisma.user.update({
                where: { id: userId },
                data: { xp_earned: { increment: xpAwarded } }
            })
        ]);

        console.log(`[EventHandler] -> Successfully awarded XP. Sending status: sold_out_xp_awarded`);
        ws.send(JSON.stringify({
            type: 'event_availability_response',
            status: 'sold_out_xp_awarded',
            xpAwarded
        }));

    } catch (err) {
        console.error('[EventHandler] Error checking event availability:', err.message);
        ws.send(JSON.stringify({ type: 'error', msg: 'Failed to check event availability' }));
    }
};

# Flutter Integration Guide: Multiplayer Live Events

This document is designed for both the **Flutter frontend team** and **AI Assistants (like Cursor/Antigravity)** to deeply understand the architecture, data flow, and exact payloads required for integrating Multiplayer Live Events.

---

## 🤖 Context for AI Assistants / AI Coders
If you are an AI assisting with the Flutter implementation, here are the architectural constraints and design patterns of this backend:
- **Backend Stack:** Node.js, Prisma (PostgreSQL), Redis, uWebSockets.js.
- **WebSocket Paradigm:** There is **only one WebSocket connection** used across the entire app (`ws://<ip>:3001/live-tracking`). The backend multiplexes different logical channels based entirely on the `"type"` field in the JSON payloads. Do not try to open multiple socket connections.
- **Event Flow:** The REST APIs are used for persistent, transactional actions (Joining, Fetching Details, Claiming). The WebSocket is used exclusively for ephemeral, real-time data (Location broadcasting, Live UI updates for remaining inventory).
- **State Management Hint:** In Flutter, the WebSocket connection should ideally be kept alive in a global singleton service (e.g., `LiveTrackingService`) and expose a `Stream<Map<String, dynamic>>` that individual ViewModels/Controllers can listen to and filter based on `type`.

---

## 1. The Core Flow (How it works on the app)

1. **Discovery:** User opens the map/list to see nearby events (live or scheduled).
2. **Joining:** User taps an event and chooses to "Join" it via REST API.
3. **Tracking (WebSocket):** When the user opens the Live Event screen, the app connects to the WebSocket and sends a `join_event` payload. This allows the user to see other players' avatars moving on the map and receive real-time inventory updates.
4. **Claiming:** When the user physically gets within 20 meters of the event coordinates, they tap "Claim Reward."
5. **Real-Time Update:** The backend processes the claim and instantly uses the WebSocket to tell *everyone else* looking at that event that the reward inventory just dropped.

---

## 2. The REST APIs

Base URL: `http://188.245.72.1:5001/api/user`
Headers Required: `Authorization: Bearer <user_jwt_token>`

### A. Get Events (Discovery)
Use this to fetch the list of events to display on the map or in a list.

- **Endpoint:** `GET /events/discovery?page=1&limit=10&status=live`
- **Query Params:**
  - `status`: `live`, `scheduled`, or `ended`
- **Response:** Array of events with `isJoined` boolean indicating if the current user is participating.

### B. Join an Event
Call this when the user clicks "Join" on a scheduled or live event.

- **Endpoint:** `GET /events/join/:eventId`
- **Response:** Success message and participant data. *Note: This triggers a real-time WebSocket broadcast telling other users the participant count increased.*

### C. Event Details
Call this to get the specific details of a single event, including whether the user has already claimed the reward.

- **Endpoint:** `GET /events/event-details/:eventId`
- **Response:** Event details object, including a `hasClaimed` boolean.

### D. Claim Reward (The most important API!)
Call this when the user is physically within 20 meters of the event and taps "Claim".

- **Endpoint:** `POST /trip/live-event/claim/:eventId`
- **Body:**
  ```json
  {
    "userLat": 40.7128,
    "userLng": -74.0060
  }
  ```
- **Response:** A success message with the unique voucher `code` and `xpEarned`. 
- **Important:** The backend calculates the distance. If the user is > 20 meters away, or if the event is sold out (`remainingQty <= 0`), it will return a 400 error.

---

## 3. The WebSocket (Real-Time Magic)

You only need **ONE** WebSocket connection for the entire app's live tracking. 

- **Endpoint:** `ws://188.245.72.1:3001/live-tracking?token=<jwt_token>`
- **Behavior:** Once connected, you send and receive JSON stringified objects. The server routes logic based on the `"type"` field in your JSON.

### Sending Data (App ➔ Server)

You must send data as stringified JSON: `jsonEncode(yourMap)`

**1. Join the Event Room (Do this when opening the event screen)**
Subscribes the user to real-time updates for this specific event.
```json
{
  "type": "join_event",
  "eventId": "EVENT ID From details api"
}
```

**2. Broadcast Player Location**
Throttle this (e.g., every 5 seconds or 10 meters) to avoid killing the battery/server. This tells everyone else in the event room where this player is.
```json
{
  "type": "player_location",
  "eventId": "EVENT ID From details api",
  "lat": 40.7128,
  "lng": -74.0060,
  "avatarUrl": "https://link-to-avatar.png" 
}
```

### Receiving Data (Server ➔ App)

Listen to the WebSocket stream and parse the incoming JSON: `jsonDecode(message)`

**1. Event Snapshot (Received immediately after sending `join_event`)**
Allows you to quickly render the UI without an extra REST API call.
```json
{
  "type": "event_snapshot",
  "eventId": "EVENT ID From details api",
  "title": "Nike Air Drop",
  "status": "live",
  "remainingQty": 15,
  "rewardQuantity": 50,
  "totalParticipants": 120,
  "endTime": "2024-12-31T23:59:59Z"
} 
```

**2. Player Location (Received when someone else moves)**
Use this to update the positions of other players' avatars on the map.
```json
{
  "type": "player_location",
  "userId": "UUID-OF-OTHER-PLAYER",
  "lat": 40.7128,
  "lng": -74.0060,
  "avatarUrl": "https://link-to-avatar.png"
}
```

**3. Inventory Update (Received when ANY player claims a reward)**
Use this to decrease the `remainingQty` counter on the UI in real-time.
```json
{
  "type": "inventory_updated",
  "eventId": "EVENT ID From details api",
  "remainingQty": 14
}
```

**4. System Chat/Commander Message (Received when a reward is claimed)**
Use this to show a snackbar/toast saying "A player just claimed a reward! 14 remaining."
```json
{
  "type": "commander_message",
  "eventId": "UUID",
  "message": "A player just claimed a reward! 14 remaining.",
  "sender": "system"
}
```

**5. Error**
```json
{
  "type": "error",
  "msg": "eventId is required to join an event room"
}
```

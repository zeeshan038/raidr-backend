# Single Player Frontend Integration Guide

This guide explains how to implement the new, optimized Single Player Zone capture flow on the frontend (Flutter). To improve performance and avoid waiting on server responses just to start a countdown, the capture timer is now handled entirely on the mobile device.

## 1. Fetching Avatar Data

The capture time is determined by the `spCaptureTimeSec` value of the user's equipped avatar. 

You can retrieve the user's purchased/equipped avatars from the Store API:
- **`GET /api/store/my-avatars`**: Returns a list of avatars the user owns. The active avatar will have `spCaptureTimeSec`.

**Action for Frontend:**
When the user logs in or selects an avatar, save their equipped avatar's `spCaptureTimeSec` to local storage (e.g., `SharedPreferences`). 
- If the avatar does not have this property (or the user has a default avatar), default to **30 seconds**.

---

## 2. Implementing the Capture UI (Local Timer)

When the user is physically inside a Raid Zone and presses the **"Capture"** button, do **NOT** make an API call yet. 

Instead, perform the following locally:
1. Read the `spCaptureTimeSec` from local storage (e.g., 15 seconds).
2. Start a visual countdown timer on the screen.
3. *Optional but recommended:* During the countdown, continue checking the user's GPS coordinates. If they walk further than the zone's `radius` (e.g., 50 meters), cancel the capture and show an error.

---

## 3. Submitting the Capture (The API Call)

Once the local countdown hits **zero**, the frontend should make a single API request to securely claim the zone. 

**Endpoint:** `POST /api/single-player/zones/:id/capture/complete`

**Request Body:**
```json
{
  "latitude": 40.7128,
  "longitude": -74.0060
}
```
*(Send the user's exact current location so the backend can verify they didn't spoof or leave the zone).*

---

## 4. Handling the API Response

The backend will instantly calculate the outcome and apply the **Shield Duration** buff automatically based on the user's avatar.

**Success (200 OK):**
```json
{
  "status": true,
  "msg": "Zone captured successfully",
  "shieldExpiresAt": "2026-09-21T14:00:00.000Z"
}
```
*Action: Play a success/celebration animation and update the zone's color/owner on the map!*

**Error (400 Bad Request):**
```json
{
  "status": false,
  "msg": "Zone is currently shielded by another player."
}
// OR
{
  "status": false,
  "msg": "Capture failed. You must be within 50m of the zone."
}
```
*Action: Show a SnackBar or Alert Dialog to the user with the `msg`.*

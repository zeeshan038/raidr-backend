# Security & Bug Fixes Report

Below is the status of the issues identified in the August 9 Raidr Survey.

| Status | Finding | Location | Details |
| :---: | :--- | :--- | :--- |
| ✅ | **Password reset never checks the OTP** | `controllers/user.js:703` | Fixed. The `resetPassword` function now properly checks the OTP code and its expiration. |
| ✅ | **send-otp returns the OTP in its response** | `controllers/user.js:250` | Fixed. `sendOTP` no longer returns the OTP code in its JSON response. |
| ❌ | **Public super-admin registration** | `routes/Admin/admin.js:6` | **Still an issue**. The `/register` endpoint is declared without the `verifyAdmin` guard. |
| ✅ | **get-all-keys returns five API keys** | `controllers/user.js:833` | Fixed. `getKeys` now only returns `googleApiKey` and `mapboxToken`. |
| ✅ | **Tokens never expire, cannot be revoked** | `utils/methods/methods.js:4` | Fixed. `jwt.sign` now includes a 7-day expiration (`{ expiresIn: '7d' }`). |
| ❌ | **Client-authoritative game economy** | `sockets/liveTracking.js:121` | **Still an issue**. The `xpAmount` is taken directly from the client's payload inside the `box_collected` event without server-side validation. |
| ✅ | **Squad channels have no membership check** | `sockets/liveTracking.js:72` | Fixed. The WebSocket upgrade process now properly checks if the user is a member of the requested squad or if the trip is shared. |
| ✅ | **Unauthenticated public file upload** | `routes/index.js:43` | Fixed. The upload route now uses the `verifyAnyAuth` middleware and has a 5MB size limit. |
| ✅ | **Rate limiting and headers** | `index.js` | Fixed. `app.set('trust proxy', 1)` has been added to ensure the rate limiter sees the correct real client IPs. |
| ✅ | **No Prisma migrations directory** | `prisma/migrations` | Fixed. The Prisma `migrations/` directory now exists. |
| ✅ | **Deploy pulls the zeeshan branch** | `.github/workflows/deploy.yml:21` | Fixed. The deployment script now dynamically pulls using `git pull origin ${{ github.ref_name }}`. |

---
*Report generated on August 18, 2026 based on codebase verification.*

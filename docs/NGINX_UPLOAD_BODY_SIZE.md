# Upload fails with CORS on large images (413)

## Symptom

Super Admin upload from `dev.admin.raidr-app.com` to `backend.raidr-app.com/api/upload/image` shows:

```text
blocked by CORS policy: No 'Access-Control-Allow-Origin' header
```

Small images work; large PNGs (~2MB) fail.

## Cause

**Nginx** (in front of prod API) default `client_max_body_size` is **1m**. The proxy returns **413** with **no CORS headers**, so the browser reports CORS instead of “file too large”.

Express already allows `https://dev.admin.raidr-app.com` in `index.js` `allowedOrigins`.

## Fix on VPS (nginx)

In the `server` block for `backend.raidr-app.com`:

```nginx
client_max_body_size 10M;
```

Then:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

## App-side mitigations

- Super Admin compresses images **before** upload when over ~1MB.
- API converts avatars to WebP and resizes large inputs with sharp.

EOF

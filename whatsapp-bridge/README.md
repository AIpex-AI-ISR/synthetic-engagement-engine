# WhatsApp bridge

A small always-on service that holds one persistent WhatsApp Web session per
user via [Baileys](https://github.com/WhiskeySockets/Baileys) and exposes it
over a minimal authenticated HTTP API. The base44 backend functions
(`whatsapp-connect`, `whatsapp-status`, `whatsapp-disconnect`) call into this
service; the frontend never talks to it directly.

This exists as a separate service because base44 functions run as
stateless/serverless Deno handlers and can't hold a long-lived WebSocket
connection, which WhatsApp Web pairing requires.

## Important: this is unofficial

Baileys implements the WhatsApp Web multi-device protocol the same way the
official web.whatsapp.com client does, but it is **not** an
Anthropic/Meta-sanctioned integration. Automating a personal WhatsApp account
this way is outside WhatsApp's Terms of Service, and the linked phone number
can be rate-limited or banned. Use a number you're comfortable putting at
risk (e.g. a dedicated test line), and treat this as a prototype path. For a
compliant production integration, migrate to the official
[WhatsApp Business Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api)
instead — same `Connection` entity and frontend UI, only this bridge would be
swapped out.

## API

All `/sessions/*` routes require `Authorization: Bearer <BRIDGE_TOKEN>`.

- `POST /sessions/:userId/connect` — starts (or resumes) a session for the
  user. Returns `{ status, qr, label }` where `status` is one of
  `connecting | qr | connected | disconnected`. `qr` is a `data:image/png`
  data URL once the code is ready; `label` is the linked phone number once
  connected.
- `GET /sessions/:userId/status` — same shape, for polling.
- `POST /sessions/:userId/disconnect` — logs out and deletes the session's
  local auth state.
- `GET /health` — unauthenticated liveness check.

## Running locally

```sh
cd whatsapp-bridge
npm install
cp .env.example .env   # set BRIDGE_TOKEN
npm start
```

## Deploying

This needs an **always-on** host with a persistent filesystem (session
credentials are written to `./sessions/<userId>/` on disk) — a normal
serverless platform won't work. Options: a small VPS, Fly.io, Railway, or
Render (with a persistent volume mounted at the working directory).

Once deployed, set these secrets on the base44 backend so the functions can
reach it:

```sh
npx base44 secrets set WHATSAPP_BRIDGE_URL=https://your-bridge-host WHATSAPP_BRIDGE_TOKEN=<same value as BRIDGE_TOKEN>
```

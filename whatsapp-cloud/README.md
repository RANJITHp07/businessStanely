# whatsapp-cloud

WhatsApp backend for the admin panel built on Meta's official **WhatsApp Cloud API** in
**coexistence** mode: the firm's number stays on the WhatsApp Business app on the phone,
and the admin panel sends/receives through the API. Messages from either side appear in both.

It is a drop-in replacement for the legacy `whatsapp/` (whatsapp-web.js) service — same HTTP
routes, same SSE stream — so the admin panel only needs `WHATSAPP_BACKEND_URL` pointed here.

## What works / what doesn't

| Works | Not possible on Cloud API |
| --- | --- |
| 1:1 chats, text, photos, video, audio, documents, replies | Group chats (blocked on purpose) |
| Messages sent from the phone (echoes) | Editing / deleting sent messages |
| Read receipts, delivered/read ticks | Calls, status/stories, profile pictures of customers |
| Contacts + ~6 months history import | Free-form messages 24h after the customer's last message (template only) |
| Approved templates, starting new chats | |

## Run

```bash
cp .env.example .env   # fill it in
npm install
npm run build
npm start              # http://localhost:4002
```

## One-time Meta setup

1. Phone: the number must use the **WhatsApp Business app** (not personal WhatsApp), be active
   for 7+ days, and be on a recent app version.
2. developers.facebook.com → create an app (type **Business**) owned by the firm's Business portfolio.
   Add the **WhatsApp** product.
3. App → **Facebook Login for Business** → Configurations → create one from the
   **WhatsApp Embedded Signup** template. Copy its id to `META_EMBEDDED_SIGNUP_CONFIG_ID`.
   Add the admin panel's domain to *Allowed domains* (HTTPS required).
4. App → WhatsApp → Configuration → Webhook:
   - Callback URL: `https://<this service>/webhook`
   - Verify token: the value of `WA_CLOUD_VERIFY_TOKEN`
   - Subscribe to: `messages`, `smb_message_echoes`, `history`, `smb_app_state_sync`
5. Copy App ID / App Secret to `META_APP_ID` / `META_APP_SECRET`. Add a payment method in
   Business Manager (needed for template messages).
6. Start the service, point the admin panel at it, open WhatsApp in the admin panel and click
   **Connect WhatsApp Business app**. Scan the QR shown with the phone and allow history sharing.
   History/contacts must be requested within 24h of connecting; the Connect flow does it
   automatically (retry: `POST /sync-history`).

Connecting unlinks existing linked devices (WhatsApp Web/Desktop and the old `whatsapp/`
service). Stop the old service after switching.

## Switching the admin and agent panels over

In **both** `admin/.env` and `agent/.env`:

```bash
WHATSAPP_BACKEND_URL=https://<this service>             # server-side proxy calls
NEXT_PUBLIC_WHATSAPP_BACKEND_URL=https://<this service> # browser opens /stream directly
WHATSAPP_SERVICE_TOKEN=<same value as this service>
```

Set `WHATSAPP_ALLOWED_ORIGIN` here to both panel origins, comma-separated, then rebuild/redeploy
both panels (`NEXT_PUBLIC_*` is baked in at build time).

- Admin panel: shows the **Connect** screen until the number is connected.
- Agent panel: shows "ask an admin to connect" until then.
- After connecting, both get the same chats, the template picker when the 24h window is closed, and
  no edit/delete buttons.

To roll back, point those variables at the old `whatsapp/` service again. It needs a new QR scan.

## Routes

Same as `whatsapp/` (`/status`, `/chats`, `/messages`, `/send`, `/media`, `/stream`, `/chat-avatar(s)`,
`/logout`) plus `/webhook` (Meta, signature-verified), `/onboard`, `/sync-history`, `/templates`,
`/send-template`.

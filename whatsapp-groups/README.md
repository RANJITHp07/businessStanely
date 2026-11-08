# whatsapp-groups

Group chats for the admin/agent panels through a **WhatsApp Web linked device**
(Baileys) on the firm's number. 1:1 chats stay on Meta's Cloud API
(`whatsapp-cloud/`); this service ignores them.

```
phone (WhatsApp Business app)
 ├─ Cloud API (coexistence) ──webhooks──▶ whatsapp-cloud :4002 ◀── admin / agent panels
 └─ linked device ──────────▶ whatsapp-groups :4003 ──POST /groups/ingest──▶ whatsapp-cloud
                                      ▲────────── POST /send, /read (group chats) ──┘
```

- whatsapp-cloud stays the only store and the only backend the panels talk to.
  Group chats show up in the same list under `<jid>@g.us`.
- When `WHATSAPP_GROUPS_URL` is set in `whatsapp-cloud/.env`, cloud ignores group
  traffic from Meta's webhooks and routes group sends here.
- Groups have no 24h reply window and no templates.
- Events are queued and retried until cloud accepts them.

## Run

```bash
cp .env.example .env   # same WHATSAPP_SERVICE_TOKEN as whatsapp-cloud
npm install
npm run build
npm start              # http://localhost:4003
```

Link once: open `http://localhost:4003/qr?token=<WHATSAPP_SERVICE_TOKEN>` (or read the
terminal QR). On the phone: **WhatsApp Business → Linked devices → Link a device**.
The session is saved in `auth/` (keep it on a persistent disk; it is a login, never
commit it). If the device is removed on the phone, the service clears `auth/` and shows
a new QR.

## Routes

Public: `GET /` and `GET /health` (liveness and link status, no secrets).

Token required (`x-whatsapp-service-token` or `?token=`): `GET /status`, `GET /qr`, `POST /send`, `POST /read`, `POST /refresh-groups`.

## Limits

Unofficial protocol: WhatsApp may log the device out or, rarely, restrict the number.
Keep it to normal human-volume group messaging (no bulk sends).

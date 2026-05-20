# WhatsApp Backend

Standalone backend service for WhatsApp Web (whatsapp-web.js).

## Run locally

1. Install dependencies:
   npm install
2. Copy env file:
   cp .env.example .env
3. Start in dev mode:
   npm run dev

## Required env

- `NEXT_PUBLIC_WHATSAPP_SERVICE_TOKEN`: shared token expected from frontend proxy.
- `WHATSAPP_ALLOWED_ORIGIN`: frontend origin for CORS.
- `WHATSAPP_SESSION_DIR`: local auth/session storage.
- `WHATSAPP_HEADLESS`: use `true` in server environments.
- `WHATSAPP_CHROMIUM_EXECUTABLE_PATH`: optional explicit browser path.

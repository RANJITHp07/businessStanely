import { EventEmitter } from "events";

import type { WhatsAppEventPayload, WhatsAppStreamEvent } from "./types.js";

const globalRealtime = globalThis as typeof globalThis & {
  __adminWhatsAppRealtime?: EventEmitter;
};

const realtimeEmitter =
  globalRealtime.__adminWhatsAppRealtime ?? new EventEmitter();

realtimeEmitter.setMaxListeners(200);

if (!globalRealtime.__adminWhatsAppRealtime) {
  globalRealtime.__adminWhatsAppRealtime = realtimeEmitter;
}

export function publishWhatsAppEvent(
  event: WhatsAppStreamEvent,
  payload: WhatsAppEventPayload = {},
) {
  realtimeEmitter.emit(event, payload);
}

export function subscribeWhatsAppEvent(
  event: WhatsAppStreamEvent,
  listener: (payload: WhatsAppEventPayload) => void | Promise<void>,
) {
  realtimeEmitter.on(event, listener);
  return () => {
    realtimeEmitter.off(event, listener);
  };
}

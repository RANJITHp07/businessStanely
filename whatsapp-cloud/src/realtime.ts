import { EventEmitter } from "events";

import type { WhatsAppEventPayload, WhatsAppStreamEvent } from "./types.js";

const globalRealtime = globalThis as typeof globalThis & {
  __adminWhatsAppCloudRealtime?: EventEmitter;
};

const realtimeEmitter =
  globalRealtime.__adminWhatsAppCloudRealtime ?? new EventEmitter();

realtimeEmitter.setMaxListeners(200);

if (!globalRealtime.__adminWhatsAppCloudRealtime) {
  globalRealtime.__adminWhatsAppCloudRealtime = realtimeEmitter;
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

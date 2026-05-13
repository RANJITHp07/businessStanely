import { EventEmitter } from "events";
const globalRealtime = globalThis;
const realtimeEmitter = globalRealtime.__adminWhatsAppRealtime ?? new EventEmitter();
realtimeEmitter.setMaxListeners(100);
if (!globalRealtime.__adminWhatsAppRealtime) {
    globalRealtime.__adminWhatsAppRealtime = realtimeEmitter;
}
export function publishWhatsAppEvent(event, payload = {}) {
    realtimeEmitter.emit(event, payload);
}
export function subscribeWhatsAppEvent(event, listener) {
    realtimeEmitter.on(event, listener);
    return () => {
        realtimeEmitter.off(event, listener);
    };
}

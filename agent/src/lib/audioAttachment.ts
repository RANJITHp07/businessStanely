// Decides whether an attachment plays inline in an <audio> player or shows as a
// link. Every page that renders comment attachments uses this, so a file that
// plays on one page plays on all of them.

// Extensions browsers can play in an <audio> element. Formats such as .amr or
// .wma are left out on purpose: no mainstream browser decodes them, so they
// stay a link rather than a player that never starts.
const PLAYABLE_AUDIO_EXTENSIONS = new Set([
  "mp3",
  "mpga",
  "m4a",
  "m4b",
  "aac",
  "wav",
  "ogg",
  "oga",
  "opus",
  "weba",
  "webm",
  "flac",
]);

// Phones label audio-only MP4s as video: WhatsApp exports voice notes as
// "WhatsApp Audio <date>.mp4" with type video/mp4. Comment uploads accept MP4
// only as an audio container (see api/upload), so there it means audio.
const MP4_TYPES = new Set(["video/mp4", "application/mp4"]);

type FileLike = {
  type?: string | null;
  name?: string | null;
  url?: string | null;
};

function baseType(type?: string | null) {
  return type?.split(";")[0].trim().toLowerCase() ?? "";
}

function extensionOf(value?: string | null) {
  const path = value?.split(/[?#]/)[0] ?? "";
  const dot = path.lastIndexOf(".");
  return dot === -1 ? "" : path.slice(dot + 1).toLowerCase();
}

/** True when the MIME type or file extension says the file is playable audio. */
export function isAudioFile(file: FileLike) {
  if (baseType(file.type).startsWith("audio/")) return true;
  return [file.name, file.url].some((value) =>
    PLAYABLE_AUDIO_EXTENSIONS.has(extensionOf(value)),
  );
}

/** isAudioFile, plus MP4s, which comment uploads only accept as audio. */
export function isAudioAttachment(file: FileLike) {
  return (
    isAudioFile(file) ||
    MP4_TYPES.has(baseType(file.type)) ||
    [file.name, file.url].some((value) => extensionOf(value) === "mp4")
  );
}

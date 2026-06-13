// Shared upload content-type resolution/validation used by both the single-part
// (`/api/upload`) and multipart (`/api/upload/multipart/init`) routes so the two
// can never drift apart.

// Canonical MIME types for audio extensions that browsers/operating systems
// frequently fail to label. A .m4a in particular often arrives with an empty
// Content-Type (or a generic "application/octet-stream"), so we fall back to the
// file extension to recognise it as audio.
const AUDIO_EXTENSION_MIME: Record<string, string> = {
  m4a: "audio/mp4",
  m4b: "audio/mp4",
  m4p: "audio/mp4",
  mp4: "audio/mp4",
  mp3: "audio/mpeg",
  mpga: "audio/mpeg",
  wav: "audio/wav",
  weba: "audio/webm",
  oga: "audio/ogg",
  ogg: "audio/ogg",
  opus: "audio/opus",
  aac: "audio/aac",
  flac: "audio/flac",
  amr: "audio/amr",
  wma: "audio/x-ms-wma",
  aiff: "audio/aiff",
  aif: "audio/aiff",
  "3gp": "audio/3gpp",
  "3gpp": "audio/3gpp",
  caf: "audio/x-caf",
  mid: "audio/midi",
  midi: "audio/midi",
};

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "audio/mp4",
];

export type ResolvedUploadType =
  | { ok: true; contentType: string }
  | { ok: false; error: string };

/**
 * Resolves the canonical Content-Type for an upload and validates it against the
 * allow-list. Any audio extension (see AUDIO_EXTENSION_MIME) is accepted even
 * when the browser reports no/garbled MIME type.
 */
export function resolveUploadContentType(
  fileName: string | undefined,
  contentType: string | undefined,
): ResolvedUploadType {
  const name = fileName?.trim();
  const parsed = contentType?.split(";")[0]?.trim()?.toLowerCase();
  const extension = name?.split(".").pop()?.toLowerCase() ?? "";
  const audioMimeFromExtension = AUDIO_EXTENSION_MIME[extension];

  // A browser-supplied type is only trustworthy when it's present and specific.
  const hasUsableType =
    Boolean(parsed) && parsed !== "application/octet-stream";

  let normalized: string | undefined;
  if (parsed === "mp4") {
    // Legacy: some clients send the bare extension as the type.
    normalized = "audio/mp4";
  } else if (hasUsableType) {
    normalized = parsed;
  } else if (audioMimeFromExtension) {
    // No usable type from the browser, but the extension is a known audio format.
    normalized = audioMimeFromExtension;
  } else {
    normalized = parsed;
  }

  if (!name || !normalized) {
    return { ok: false, error: "Invalid upload payload" };
  }

  // Accept anything that is audio by MIME OR by a recognised audio extension.
  const isAllowedAudio =
    normalized.startsWith("audio/") || Boolean(audioMimeFromExtension);
  const isAllowedMp4Container =
    normalized === "video/mp4" || normalized === "application/mp4";

  if (
    !ALLOWED_TYPES.includes(normalized) &&
    !isAllowedAudio &&
    !isAllowedMp4Container
  ) {
    return { ok: false, error: "File type not allowed" };
  }

  return { ok: true, contentType: normalized };
}

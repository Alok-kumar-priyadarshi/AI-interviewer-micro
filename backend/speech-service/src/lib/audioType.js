// Container types we accept, keyed by base MIME type, with the file extension Whisper expects.
export const ALLOWED_AUDIO = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "mp4",
  "audio/x-m4a": "m4a",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
};

export function baseMimeType(mimetype) {
  return String(mimetype ?? "").split(";")[0].trim().toLowerCase();
}

const startsWith = (buf, bytes, offset = 0) => bytes.every((b, i) => buf[offset + i] === b);

/** Detects the audio container from its leading bytes. Returns a family name or null. */
export function sniffAudio(buffer) {
  if (!buffer || buffer.length < 12) return null;
  if (startsWith(buffer, [0x1a, 0x45, 0xdf, 0xa3])) return "webm";
  if (startsWith(buffer, [0x4f, 0x67, 0x67, 0x53])) return "ogg";
  if (startsWith(buffer, [0x52, 0x49, 0x46, 0x46]) && startsWith(buffer, [0x57, 0x41, 0x56, 0x45], 8)) return "wav";
  if (startsWith(buffer, [0x66, 0x74, 0x79, 0x70], 4)) return "mp4";
  if (startsWith(buffer, [0x49, 0x44, 0x33]) || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0)) return "mp3";
  return null;
}

// Which sniffed families are acceptable for each declared extension.
const COMPATIBLE = {
  webm: ["webm"],
  ogg: ["ogg"],
  mp4: ["mp4"],
  m4a: ["mp4"],
  mp3: ["mp3"],
  wav: ["wav"],
};

export function isCompatible(extension, sniffed) {
  return Boolean(sniffed && COMPATIBLE[extension]?.includes(sniffed));
}

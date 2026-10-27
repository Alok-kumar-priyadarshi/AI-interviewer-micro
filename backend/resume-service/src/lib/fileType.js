export const MIME_TYPES = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

/** Detects PDF or DOCX from file contents (never from headers or names). */
export function detectFileType(buffer) {
  if (!buffer || buffer.length < 8) return null;
  if (buffer.subarray(0, 5).toString("latin1") === "%PDF-") return "pdf";
  const isZip = buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;
  // Zip entry names are stored uncompressed, so a DOCX always contains this path in plain bytes.
  if (isZip && buffer.includes("word/document.xml", 0, "latin1")) return "docx";
  return null;
}

/** File name from a Content-Disposition header, preferring the RFC 5987 UTF-8 form. */
export function fileNameFromDisposition(header) {
  if (!header) return null;
  const encoded = header.match(/filename\*\s*=\s*utf-8''([^;]+)/i);
  if (encoded) {
    try {
      return decodeURIComponent(encoded[1].trim()).slice(0, 255);
    } catch {
      // fall through to the plain form
    }
  }
  const plain = header.match(/filename\s*=\s*"?([^";]+)"?/i);
  return plain ? plain[1].trim().slice(0, 255) : null;
}

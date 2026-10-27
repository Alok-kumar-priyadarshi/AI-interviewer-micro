import mammoth from "mammoth";
import { extractText as extractPdfText, getDocumentProxy } from "unpdf";
import { errors } from "../clients/driveFetcher.js";

const PARSE_TIMEOUT_MS = 15_000;

function withTimeout(promise) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("parse timeout")), PARSE_TIMEOUT_MS);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function parse(buffer, type) {
  if (type === "pdf") {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractPdfText(pdf, { mergePages: true });
    return Array.isArray(text) ? text.join("\n") : text;
  }
  const { value } = await mammoth.extractRawText({ buffer });
  return value;
}

/** Extracts plain text. Corrupt, encrypted or unparseable files are "Link is not valid". */
export async function extractResumeText(buffer, type) {
  try {
    return String((await withTimeout(parse(buffer, type))) ?? "");
  } catch {
    throw errors.linkNotValid();
  }
}

/** Letters and digits only, so whitespace and layout junk can't pass the minimum-length check. */
export function readableLength(text) {
  return (String(text).match(/[\p{L}\p{N}]/gu) ?? []).length;
}

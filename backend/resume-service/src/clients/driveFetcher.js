import { AppError } from "../lib/AppError.js";
import { fileNameFromDisposition } from "../lib/fileType.js";

const MAX_REDIRECTS = 5;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

export const errors = {
  invalidUrl: () => new AppError("INVALID_URL", 400, "Not a valid URL"),
  notPublic: () => new AppError("NOT_PUBLIC", 403, "Not a public viewable resume"),
  linkNotValid: () => new AppError("LINK_NOT_VALID", 422, "Link is not valid"),
  tooLarge: (mb) => new AppError("FILE_TOO_LARGE", 413, `Resume file is too large (max ${mb} MB)`),
};

/** Only Google's own download hosts may be followed; anything else is an SSRF attempt or not a file. */
export function isAllowedHost(hostname) {
  const host = hostname.toLowerCase();
  return (
    host === "drive.google.com" ||
    host === "drive.usercontent.google.com" ||
    host.endsWith(".googleusercontent.com")
  );
}

async function readCapped(body, maxBytes, maxMb) {
  const chunks = [];
  let size = 0;
  for await (const chunk of body) {
    size += chunk.length;
    if (size > maxBytes) throw errors.tooLarge(maxMb);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/** Decides what an HTML page from Drive means: login wall, missing file, or not a downloadable file. */
export function classifyHtml(html) {
  const page = html.toLowerCase();
  if (
    page.includes("accounts.google.com") &&
    (page.includes("sign in") || page.includes("servicelogin") || page.includes("signin"))
  ) {
    return errors.notPublic();
  }
  if (page.includes("you need access") || page.includes("request access") || page.includes("need permission")) {
    return errors.notPublic();
  }
  if (page.includes("virus scan warning") || page.includes("too large for google to scan")) {
    return errors.tooLarge(5);
  }
  if (
    page.includes("file does not exist") ||
    page.includes("error 404") ||
    page.includes("we're sorry. you can't access this item") ||
    page.includes("not found")
  ) {
    return errors.invalidUrl();
  }
  return errors.linkNotValid();
}

/**
 * Downloads a Drive file exactly as an anonymous visitor would (no credentials), so a private
 * file shows up as a login redirect. Redirects are followed manually and only to allow-listed
 * HTTPS hosts. The body is streamed and cut off past `maxMb`.
 */
export async function fetchPublicDriveFile(fileId, { maxMb, timeoutMs }) {
  const maxBytes = Math.floor(maxMb * 1024 * 1024);
  const signal = AbortSignal.timeout(timeoutMs);
  let url = new URL("https://drive.google.com/uc");
  url.searchParams.set("export", "download");
  url.searchParams.set("id", fileId);

  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      const res = await fetch(url, {
        redirect: "manual",
        signal,
        headers: { "user-agent": "Mozilla/5.0 (compatible; MockInterviewer/1.0)", accept: "*/*" },
      });

      if (REDIRECT_STATUSES.has(res.status)) {
        await res.body?.cancel();
        const location = res.headers.get("location");
        if (!location) throw errors.linkNotValid();
        const next = new URL(location, url);
        if (next.hostname.toLowerCase() === "accounts.google.com") throw errors.notPublic();
        if (next.protocol !== "https:" || !isAllowedHost(next.hostname)) throw errors.linkNotValid();
        url = next;
        continue;
      }

      if (res.status === 404 || res.status === 410) throw errors.invalidUrl();
      if (res.status === 401 || res.status === 403) throw errors.notPublic();
      if (!res.ok || !res.body) {
        throw new AppError("UPSTREAM_UNAVAILABLE", 502, "Google Drive is unavailable, please retry");
      }

      const declared = Number(res.headers.get("content-length"));
      if (Number.isFinite(declared) && declared > maxBytes) {
        await res.body.cancel();
        throw errors.tooLarge(maxMb);
      }

      const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
      const buffer = await readCapped(res.body, maxBytes, maxMb);
      if (contentType.includes("text/html")) throw classifyHtml(buffer.toString("utf8"));

      return {
        buffer,
        contentType,
        fileName: fileNameFromDisposition(res.headers.get("content-disposition")),
      };
    }
    throw errors.linkNotValid();
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (err?.name === "TimeoutError" || err?.name === "AbortError") {
      throw new AppError("UPSTREAM_TIMEOUT", 504, "Google Drive took too long, please retry");
    }
    throw new AppError("UPSTREAM_UNAVAILABLE", 502, "Google Drive is unavailable, please retry");
  }
}

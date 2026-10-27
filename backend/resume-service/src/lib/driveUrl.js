const FILE_ID = /^[A-Za-z0-9_-]{20,}$/;

/**
 * Classifies a pasted link.
 * - { kind: "file", fileId }  a Drive file link we can try to download
 * - { kind: "not_file" }      a Drive/Google link that is not a single file (folder, Docs, Sheets…)
 * - { kind: "invalid" }       not a URL, not Google Drive, or a Drive URL without a usable file id
 */
export function parseDriveUrl(input) {
  let url;
  try {
    url = new URL(String(input ?? "").trim());
  } catch {
    return { kind: "invalid" };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return { kind: "invalid" };

  const host = url.hostname.toLowerCase();
  if (host === "docs.google.com") return { kind: "not_file" };
  if (host !== "drive.google.com") return { kind: "invalid" };

  const path = url.pathname.replace(/\/+$/, "");
  if (/\/folders\//.test(path) || path.startsWith("/drive")) return { kind: "not_file" };

  let fileId = null;
  const fileMatch = path.match(/^\/file\/(?:u\/\d+\/)?d\/([^/]+)/);
  if (fileMatch) fileId = fileMatch[1];
  else if (path === "/open" || path === "/uc") fileId = url.searchParams.get("id");

  if (!fileId || !FILE_ID.test(fileId)) return { kind: "invalid" };
  return { kind: "file", fileId };
}

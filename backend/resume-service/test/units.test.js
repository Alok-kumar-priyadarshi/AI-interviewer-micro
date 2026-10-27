import { afterEach, describe, expect, it, vi } from "vitest";
import { classifyHtml, fetchPublicDriveFile, isAllowedHost } from "../src/clients/driveFetcher.js";
import { parseDriveUrl } from "../src/lib/driveUrl.js";
import { detectFileType, fileNameFromDisposition } from "../src/lib/fileType.js";
import { buildChunks } from "../src/services/chunker.js";
import { heuristicScore } from "../src/services/resumeDetector.js";
import { INVOICE_LINES, makePdf, PROFILE, RESUME_LINES, driveResponse } from "./helpers/fixtures.js";

const ID = "1AbCdEfGhIjKlMnOpQrStUvWxYz012345";

describe("parseDriveUrl", () => {
  it.each([
    [`https://drive.google.com/file/d/${ID}/view?usp=sharing`, { kind: "file", fileId: ID }],
    [`https://drive.google.com/file/d/${ID}/edit`, { kind: "file", fileId: ID }],
    [`https://drive.google.com/file/u/1/d/${ID}/preview`, { kind: "file", fileId: ID }],
    [`https://drive.google.com/open?id=${ID}`, { kind: "file", fileId: ID }],
    [`https://drive.google.com/uc?id=${ID}&export=download`, { kind: "file", fileId: ID }],
    [`https://drive.google.com/drive/folders/${ID}`, { kind: "not_file" }],
    [`https://drive.google.com/drive/u/0/folders/${ID}`, { kind: "not_file" }],
    [`https://drive.google.com/drive/my-drive`, { kind: "not_file" }],
    [`https://docs.google.com/document/d/${ID}/edit`, { kind: "not_file" }],
    [`https://docs.google.com/spreadsheets/d/${ID}/edit`, { kind: "not_file" }],
    [`https://docs.google.com/presentation/d/${ID}/edit`, { kind: "not_file" }],
    [`https://docs.google.com/forms/d/${ID}/viewform`, { kind: "not_file" }],
    ["hello", { kind: "invalid" }],
    ["https://example.com/file/d/abc/view", { kind: "invalid" }],
    ["ftp://drive.google.com/file/d/x", { kind: "invalid" }],
    ["https://drive.google.com/file/d/short/view", { kind: "invalid" }],
    ["https://drive.google.com/", { kind: "invalid" }],
    ["https://drive.google.com.evil.com/file/d/" + ID, { kind: "invalid" }],
  ])("%s", (input, expected) => {
    expect(parseDriveUrl(input)).toEqual(expected);
  });
});

describe("file helpers", () => {
  it("detects PDF and DOCX by content only", () => {
    expect(detectFileType(makePdf(["hi"]))).toBe("pdf");
    const docx = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from("....word/document.xml....")]);
    expect(detectFileType(docx)).toBe("docx");
    const plainZip = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from("....photos/a.jpg.....")]);
    expect(detectFileType(plainZip)).toBeNull();
    expect(detectFileType(Buffer.from("\x89PNG\r\n\x1a\n...."))).toBeNull();
  });

  it("reads file names from Content-Disposition", () => {
    expect(fileNameFromDisposition(`attachment; filename="Asha Resume.pdf"`)).toBe("Asha Resume.pdf");
    expect(fileNameFromDisposition(`attachment; filename*=UTF-8''Asha%20R%C3%A9sum%C3%A9.pdf`)).toBe("Asha Résumé.pdf");
    expect(fileNameFromDisposition(null)).toBeNull();
  });

  it("allows only Google download hosts", () => {
    expect(isAllowedHost("drive.usercontent.google.com")).toBe(true);
    expect(isAllowedHost("doc-0s-1c-docs.googleusercontent.com")).toBe(true);
    expect(isAllowedHost("evil.com")).toBe(false);
    expect(isAllowedHost("googleusercontent.com.evil.com")).toBe(false);
  });

  it("classifies Drive HTML pages", () => {
    expect(classifyHtml("<a href='https://accounts.google.com/ServiceLogin'>Sign in</a>").code).toBe("NOT_PUBLIC");
    expect(classifyHtml("You need access. Request access").code).toBe("NOT_PUBLIC");
    expect(classifyHtml("<title>Google Drive - 404</title>Error 404 (Not Found)").code).toBe("INVALID_URL");
    expect(classifyHtml("<html>some other page</html>").code).toBe("LINK_NOT_VALID");
  });
});

describe("heuristicScore", () => {
  it("scores resumes high and invoices low", () => {
    expect(heuristicScore(RESUME_LINES.join("\n"))).toBeGreaterThanOrEqual(0.6);
    expect(heuristicScore(INVOICE_LINES.join("\n"))).toBeLessThan(0.2);
  });
});

describe("buildChunks", () => {
  it("creates one chunk per project and job plus summary, skills, education, certifications", () => {
    const chunks = buildChunks(PROFILE, "raw");
    const sections = chunks.map((c) => c.section);
    expect(sections.filter((s) => s === "project")).toHaveLength(2);
    expect(sections).toEqual(expect.arrayContaining(["summary", "skills", "experience", "education", "other"]));
    const shop = chunks.find((c) => c.title === "ShopLite");
    expect(shop.content).toContain("Stack: React, Node, Redis");
    expect(shop.embedText.startsWith("project: ShopLite")).toBe(true);
  });

  it("falls back to raw text when the profile is nearly empty", () => {
    const empty = { skills: {}, projects: [], experience: [], education: [], certifications: [] };
    const chunks = buildChunks(empty, "x".repeat(3000));
    expect(chunks.every((c) => c.section === "other")).toBe(true);
    expect(chunks.length).toBeGreaterThan(1);
  });
});

describe("fetchPublicDriveFile", () => {
  afterEach(() => vi.unstubAllGlobals());
  const opts = { maxMb: 1, timeoutMs: 5000 };

  it("follows allowed redirects and returns the file", async () => {
    const pdf = makePdf(RESUME_LINES);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(driveResponse({ status: 302, headers: { location: "https://drive.usercontent.google.com/download?id=x" } }))
      .mockResolvedValueOnce(
        driveResponse({ headers: { "content-type": "application/pdf", "content-disposition": 'attachment; filename="cv.pdf"' }, body: pdf }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const file = await fetchPublicDriveFile(ID, opts);
    expect(file.fileName).toBe("cv.pdf");
    expect(file.buffer.equals(pdf)).toBe(true);
    expect(String(fetchMock.mock.calls[0][0])).toContain(`id=${ID}`);
  });

  it("treats a redirect to Google sign-in as private", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(driveResponse({ status: 302, headers: { location: "https://accounts.google.com/ServiceLogin?x" } })));
    await expect(fetchPublicDriveFile(ID, opts)).rejects.toMatchObject({ code: "NOT_PUBLIC" });
  });

  it("refuses redirects to other hosts (SSRF)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(driveResponse({ status: 302, headers: { location: "http://169.254.169.254/latest/meta-data" } })));
    await expect(fetchPublicDriveFile(ID, opts)).rejects.toMatchObject({ code: "LINK_NOT_VALID" });
  });

  it("maps 404 to INVALID_URL", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(driveResponse({ status: 404 })));
    await expect(fetchPublicDriveFile(ID, opts)).rejects.toMatchObject({ code: "INVALID_URL" });
  });

  it("stops reading once the size cap is passed", async () => {
    const big = Buffer.alloc(2 * 1024 * 1024, 1);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(driveResponse({ headers: { "content-type": "application/pdf" }, body: big })));
    await expect(fetchPublicDriveFile(ID, opts)).rejects.toMatchObject({ code: "FILE_TOO_LARGE" });
  });

  it("reads HTML responses as login walls or invalid links", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(driveResponse({ headers: { "content-type": "text/html" }, body: Buffer.from("Sign in - accounts.google.com") })),
    );
    await expect(fetchPublicDriveFile(ID, opts)).rejects.toMatchObject({ code: "NOT_PUBLIC" });
  });
});

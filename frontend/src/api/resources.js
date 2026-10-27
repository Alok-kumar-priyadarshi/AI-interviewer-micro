import { api } from "./client.js";

// Resumes
export const listResumes = () => api.get("/resumes").then((r) => r.items);
export const addResume = (driveUrl) => api.post("/resumes", { driveUrl }).then((r) => r.resume);
export const deleteResume = (id) => api.delete(`/resumes/${id}`);

// Interviews
export const listInterviews = () => api.get("/interviews?limit=50").then((r) => r.items);
export const getInterview = (id) => api.get(`/interviews/${id}`);
export const createInterview = (input) => api.post("/interviews", input).then((r) => r.session);
export const answerTurn = (sessionId, turnId, input) =>
  api.post(`/interviews/${sessionId}/turns/${turnId}/answer`, input);
export const endInterview = (sessionId) => api.post(`/interviews/${sessionId}/end`);

// Reports
export const listReports = () => api.get("/reports?limit=50").then((r) => r.items);
export const getReport = (sessionId) => api.get(`/reports/by-session/${sessionId}`);

// Speech
const EXTENSIONS = { "audio/webm": "webm", "audio/mp4": "mp4", "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/wav": "wav" };

export function transcribe(blob, hint) {
  const type = (blob.type || "audio/webm").split(";")[0];
  const form = new FormData();
  form.append("audio", blob, `answer.${EXTENSIONS[type] ?? "webm"}`);
  if (hint) form.append("hint", hint.slice(0, 300));
  return api.upload("/speech/transcribe", form);
}

/** Calls `onEvent` for every NDJSON line of a streamed response body. */
export async function readNdjson(body, onEvent) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newline = buffer.indexOf("\n");
    while (newline >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line) onEvent(JSON.parse(line));
      newline = buffer.indexOf("\n");
    }
  }
  const rest = (buffer + decoder.decode()).trim();
  if (rest) onEvent(JSON.parse(rest));
}

/** Streams the next question: start → delta… → (replace) → done, or an error event. */
export async function streamNextQuestion(sessionId, onEvent, signal) {
  const res = await api.stream(`/interviews/${sessionId}/next`, { signal });
  await readNdjson(res.body, onEvent);
}

// User-facing text for every API error code (docs/07-api-contracts.md). The resume link
// messages are exactly the ones features.md asks for.
const MESSAGES = {
  VALIDATION_ERROR: "Please check the highlighted fields",
  INVALID_URL: "Not a valid URL",
  NOT_PUBLIC: "Not a public viewable resume",
  LINK_NOT_VALID: "Link is not valid",
  NOT_A_RESUME: "Please add resume link",
  FILE_TOO_LARGE: "Resume file is too large (max 5 MB)",
  RESUME_UNSAFE: "Resume contains disallowed content",
  EMAIL_TAKEN: "An account with this email already exists",
  INVALID_CREDENTIALS: "Incorrect email or password",
  ACCOUNT_LOCKED: "Too many attempts. Try again in 15 minutes",
  TOKEN_INVALID: "Please log in again",
  REFRESH_INVALID: "Please log in again",
  SESSION_REVOKED: "Please log in again",
  NOT_FOUND: "Not found",
  SESSION_COMPLETED: "This interview has ended",
  NO_MORE_QUESTIONS: "All questions have been asked",
  TURN_ALREADY_ANSWERED: "This question was already answered",
  AUDIO_TOO_LARGE: "Recording is too long (max 3 minutes)",
  UNSUPPORTED_AUDIO: "Unsupported audio format",
  EMPTY_TRANSCRIPT: "We couldn't hear an answer, please try again",
  AI_BUSY: "The AI is busy right now. Please try again in a minute",
  UPSTREAM_UNAVAILABLE: "Service unavailable, please retry",
  UPSTREAM_TIMEOUT: "The request took too long, please retry",
  PAYLOAD_TOO_LARGE: "Request is too large",
  NETWORK_ERROR: "Can't reach the server. Check your connection and retry.",
};

// For these codes the server's own message is more specific (e.g. "Google Drive is unavailable").
const PREFER_SERVER_MESSAGE = new Set(["ACCOUNT_LOCKED", "UPSTREAM_UNAVAILABLE", "UPSTREAM_TIMEOUT"]);

export function errorMessage(error) {
  if (PREFER_SERVER_MESSAGE.has(error?.code) && error.message) return error.message;
  return MESSAGES[error?.code] ?? error?.message ?? "Something went wrong";
}

/** { fieldPath: message } from a VALIDATION_ERROR's details. */
export function fieldErrors(error) {
  return Object.fromEntries((error?.details ?? []).map((d) => [d.path, d.message]));
}

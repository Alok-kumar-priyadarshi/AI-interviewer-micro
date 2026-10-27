// Headers only the gateway may set. A browser sending them must never be trusted.
const INTERNAL_HEADERS = ["x-user-id", "x-internal-key"];

export function stripInternalHeaders(req, _res, next) {
  for (const name of INTERNAL_HEADERS) delete req.headers[name];
  next();
}

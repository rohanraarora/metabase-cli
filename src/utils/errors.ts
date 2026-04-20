// Metabase returns 5–20 KB Clojure stacktraces for most 500s. Printing the
// full body on every failure blows the context window when the CLI is driven
// from an LLM. We extract a one-line human-readable message by default and
// keep the raw payload for `--verbose`.

const MAX_FALLBACK_LEN = 500;

export class ApiError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly body: string;
  readonly shortMessage: string;

  constructor(status: number, statusText: string, body: string) {
    const short = extractApiErrorMessage(body);
    super(`${status} ${statusText}: ${short}`);
    this.name = "ApiError";
    this.status = status;
    this.statusText = statusText;
    this.body = body;
    this.shortMessage = short;
  }
}

export function extractApiErrorMessage(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return "(empty response)";

  // Plain-text / non-JSON bodies: "Not found.", "Unauthenticated", HTML, etc.
  const firstChar = trimmed[0];
  if (firstChar !== "{" && firstChar !== "[" && firstChar !== '"') {
    return truncate(trimmed);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return truncate(trimmed);
  }

  // Some endpoints wrap errors as a bare JSON string ("API endpoint does not exist.").
  if (typeof parsed === "string") return truncate(parsed);

  if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;

    const message = pickString(obj, "message");
    if (message) return truncate(message);

    const error = pickString(obj, "error");
    if (error) return truncate(error);

    const cause = pickString(obj, "cause");
    if (cause) return truncate(cause);

    // 400 validation errors: {"errors": {"field": "must be ..."}}
    if (obj.errors && typeof obj.errors === "object") {
      const entries = Object.entries(obj.errors as Record<string, unknown>)
        .map(([field, msg]) => `${field}: ${String(msg)}`)
        .join("; ");
      if (entries) return truncate(entries);
    }
  }

  return truncate(trimmed);
}

function pickString(obj: Record<string, unknown>, key: string): string | null {
  const v = obj[key];
  return typeof v === "string" && v.length > 0 ? v : null;
}

function truncate(s: string): string {
  const oneLine = s.replace(/\s+/g, " ").trim();
  if (oneLine.length <= MAX_FALLBACK_LEN) return oneLine;
  return `${oneLine.slice(0, MAX_FALLBACK_LEN)}… (truncated, use --verbose for full body)`;
}

export function isVerbose(): boolean {
  return process.env.METABASE_CLI_VERBOSE === "1";
}

// Query endpoints return 200 with {status: "failed", error, stacktrace, via}.
// `error` is usually a string but can be a nested object; either way we want a
// one-liner, not the whole payload dumped via console's %O formatter.
export function formatInBandError(value: unknown): string {
  if (value === null || value === undefined) return "unknown error";
  const asString = typeof value === "string" ? value : JSON.stringify(value);
  return extractApiErrorMessage(asString);
}

export function handleError(err: unknown): never {
  if (err instanceof ApiError) {
    console.error(`Error: ${err.message}`);
    if (isVerbose()) {
      console.error("--- full response body ---");
      console.error(err.body);
    }
    process.exit(1);
  }
  if (err instanceof Error) {
    console.error(`Error: ${err.message}`);
  } else {
    console.error("Unknown error:", err);
  }
  process.exit(1);
}

import { describe, it, expect } from "vitest";
import { ApiError, extractApiErrorMessage, formatInBandError } from "../src/utils/errors.js";

describe("extractApiErrorMessage", () => {
  it("returns empty-response marker when body is empty", () => {
    expect(extractApiErrorMessage("")).toBe("(empty response)");
    expect(extractApiErrorMessage("   ")).toBe("(empty response)");
  });

  it("passes through plain-text bodies (404 'Not found.')", () => {
    expect(extractApiErrorMessage("Not found.")).toBe("Not found.");
    expect(extractApiErrorMessage("Unauthenticated")).toBe("Unauthenticated");
  });

  it("unwraps bare JSON string bodies", () => {
    expect(extractApiErrorMessage('"API endpoint does not exist."')).toBe(
      "API endpoint does not exist.",
    );
  });

  it("extracts top-level `message` from a 500 Clojure exception payload", () => {
    // This is the shape that used to blow up context: ~15 KB of via/trace/data.
    const body = JSON.stringify({
      via: [{ type: "clojure.lang.ExceptionInfo", message: "x", data: {}, at: [] }],
      trace: new Array(500).fill("frame"),
      cause: "x",
      data: {},
      message: 'Invalid parameter: Card 24,009 does not have a template tag named "since_date".',
      "invalid-parameter": {},
      "allowed-parameters": null,
    });
    expect(body.length).toBeGreaterThan(3000);
    expect(extractApiErrorMessage(body)).toBe(
      'Invalid parameter: Card 24,009 does not have a template tag named "since_date".',
    );
  });

  it("prefers `error` when `message` is absent (query processor failures)", () => {
    const body = JSON.stringify({
      status: "failed",
      error: "Unable to substitute parameters: No matching clause",
      stacktrace: new Array(80).fill("qp.clj:123"),
      via: [{ error: "same" }],
    });
    expect(extractApiErrorMessage(body)).toBe(
      "Unable to substitute parameters: No matching clause",
    );
  });

  it("falls back to `cause` when `message`/`error` absent", () => {
    const body = JSON.stringify({ cause: "Something broke", trace: ["a", "b"] });
    expect(extractApiErrorMessage(body)).toBe("Something broke");
  });

  it("flattens 400 validation errors from `errors` field", () => {
    const body = JSON.stringify({
      "specific-errors": { name: ["missing required key"] },
      errors: {
        name: "value must be a non-blank string.",
        display: "value must be a non-blank string.",
      },
    });
    const out = extractApiErrorMessage(body);
    expect(out).toContain("name: value must be a non-blank string.");
    expect(out).toContain("display: value must be a non-blank string.");
  });

  it("truncates very long bodies with a use-verbose hint", () => {
    const huge = "x".repeat(2000);
    const out = extractApiErrorMessage(huge);
    expect(out.length).toBeLessThan(huge.length);
    expect(out).toContain("truncated, use --verbose");
  });

  it("collapses whitespace / newlines to single spaces", () => {
    expect(extractApiErrorMessage("line1\n\nline2\t\ttab")).toBe("line1 line2 tab");
  });

  it("falls back to raw body when JSON has no recognizable error keys", () => {
    const body = JSON.stringify({ random: "payload", nested: { foo: 1 } });
    // Not a known shape → should still produce something, not crash.
    expect(extractApiErrorMessage(body)).toContain("random");
  });
});

describe("ApiError", () => {
  it("composes a single-line message from status + extracted body", () => {
    const body = JSON.stringify({ message: "Invalid parameter: ..." });
    const err = new ApiError(500, "Server Error", body);
    expect(err.message).toBe("500 Server Error: Invalid parameter: ...");
    expect(err.status).toBe(500);
    expect(err.body).toBe(body); // raw body preserved for --verbose
    expect(err.shortMessage).toBe("Invalid parameter: ...");
    expect(err.name).toBe("ApiError");
  });

  it("caps the visible message even for monstrous bodies", () => {
    const body = JSON.stringify({ message: "y".repeat(2000) });
    const err = new ApiError(500, "Server Error", body);
    expect(err.message.length).toBeLessThan(700);
    expect(err.body.length).toBeGreaterThan(2000); // raw still intact
  });
});

describe("formatInBandError", () => {
  it("handles string errors by running them through the extractor", () => {
    expect(formatInBandError("Simple error")).toBe("Simple error");
  });

  it("handles null/undefined", () => {
    expect(formatInBandError(null)).toBe("unknown error");
    expect(formatInBandError(undefined)).toBe("unknown error");
  });

  it("flattens an object error into a one-liner", () => {
    expect(formatInBandError({ message: "boom", stacktrace: ["a", "b"] })).toBe("boom");
  });
});

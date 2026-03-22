import { describe, it, expect, vi, afterEach } from "vitest";
import type { Profile } from "../src/types.js";

vi.mock("../src/config/store.js", () => ({
  updateProfile: vi.fn(),
  loadConfig: vi.fn(),
  saveConfig: vi.fn(),
  getActiveProfile: vi.fn(),
}));

import { MetabaseClient } from "../src/client.js";
import { DatasetApi } from "../src/api/dataset.js";
import { CardApi } from "../src/api/card.js";
import { checkExportError, EXT_TO_FORMAT } from "../src/utils/export.js";

function makeProfile(): Profile {
  return {
    name: "test",
    domain: "https://metabase.test.com",
    auth: {
      method: "api-key" as const,
      apiKey: "mb_test_key",
    },
  };
}

function mockFetchResponse(data: Buffer | string, ok = true, status = 200): Response {
  const buf = typeof data === "string" ? Buffer.from(data) : data;
  return {
    ok,
    status,
    headers: new Headers(),
    text: () => Promise.resolve(buf.toString("utf-8")),
    arrayBuffer: () =>
      Promise.resolve(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)),
  } as Response;
}

describe("Export functionality", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe("DatasetApi.exportBinary", () => {
    it("returns buffer for successful CSV export", async () => {
      const client = new MetabaseClient(makeProfile());
      const api = new DatasetApi(client);
      const csvData = "id,name\n1,Alice\n2,Bob";

      globalThis.fetch = vi.fn().mockResolvedValue(mockFetchResponse(csvData));

      const result = await api.exportBinary(
        { type: "native", database: 1, native: { query: "SELECT 1" } },
        "csv",
      );

      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result.toString("utf-8")).toBe(csvData);
    });

    it("sends query as form-encoded JSON string", async () => {
      const client = new MetabaseClient(makeProfile());
      const api = new DatasetApi(client);

      globalThis.fetch = vi.fn().mockResolvedValue(mockFetchResponse("ok"));

      const query = { type: "native" as const, database: 1, native: { query: "SELECT 1" } };
      await api.exportBinary(query, "csv");

      const call = (globalThis.fetch as any).mock.calls[0];
      expect(call[0]).toBe("https://metabase.test.com/api/dataset/csv");
      expect(call[1].body).toBeInstanceOf(URLSearchParams);
      expect(call[1].body.get("query")).toBe(JSON.stringify(query));
    });

    it("throws on HTTP error", async () => {
      const client = new MetabaseClient(makeProfile());
      const api = new DatasetApi(client);

      globalThis.fetch = vi.fn().mockResolvedValue(mockFetchResponse("bad request", false, 400));

      await expect(
        api.exportBinary({ type: "native", database: 1, native: { query: "BAD SQL" } }, "csv"),
      ).rejects.toThrow("Export failed: 400");
    });

    it("detects JSON error body in CSV response", async () => {
      const client = new MetabaseClient(makeProfile());
      const api = new DatasetApi(client);
      const errorBody = JSON.stringify({
        status: "failed",
        error: "column does not exist",
      });

      globalThis.fetch = vi.fn().mockResolvedValue(mockFetchResponse(errorBody));

      await expect(
        api.exportBinary(
          { type: "native", database: 1, native: { query: "SELECT bad_col" } },
          "csv",
        ),
      ).rejects.toThrow("Query failed: column does not exist");
    });

    it("detects JSON error body in XLSX response", async () => {
      const client = new MetabaseClient(makeProfile());
      const api = new DatasetApi(client);
      const errorBody = JSON.stringify({
        status: "failed",
        error: "table not found",
      });

      globalThis.fetch = vi.fn().mockResolvedValue(mockFetchResponse(errorBody));

      await expect(
        api.exportBinary(
          { type: "native", database: 1, native: { query: "SELECT * FROM bad" } },
          "xlsx",
        ),
      ).rejects.toThrow("Query failed: table not found");
    });

    it("does not false-positive on JSON export starting with {", async () => {
      const client = new MetabaseClient(makeProfile());
      const api = new DatasetApi(client);
      // Valid JSON export that starts with { but has status "failed" would be an error
      // but normal JSON array starts with [ so this tests the format !== "json" guard
      const jsonData = JSON.stringify({ status: "failed", error: "oops" });

      globalThis.fetch = vi.fn().mockResolvedValue(mockFetchResponse(jsonData));

      // For "json" format, checkExportError skips the check
      const result = await api.exportBinary(
        { type: "native", database: 1, native: { query: "SELECT 1" } },
        "json",
      );
      expect(result.toString("utf-8")).toBe(jsonData);
    });
  });

  describe("CardApi.queryExportBinary", () => {
    it("returns buffer for successful export", async () => {
      const client = new MetabaseClient(makeProfile());
      const api = new CardApi(client);
      const csvData = "id,name\n1,Alice";

      globalThis.fetch = vi.fn().mockResolvedValue(mockFetchResponse(csvData));

      const result = await api.queryExportBinary(42, "csv");

      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result.toString("utf-8")).toBe(csvData);

      const call = (globalThis.fetch as any).mock.calls[0];
      expect(call[0]).toBe("https://metabase.test.com/api/card/42/query/csv");
    });

    it("sends parameters as form-encoded JSON", async () => {
      const client = new MetabaseClient(makeProfile());
      const api = new CardApi(client);

      globalThis.fetch = vi.fn().mockResolvedValue(mockFetchResponse("ok"));

      const params = [{ id: "p1", type: "string/=", value: "test" }];
      await api.queryExportBinary(42, "csv", params);

      const call = (globalThis.fetch as any).mock.calls[0];
      expect(call[1].body.get("parameters")).toBe(JSON.stringify(params));
    });

    it("omits parameters field when no parameters", async () => {
      const client = new MetabaseClient(makeProfile());
      const api = new CardApi(client);

      globalThis.fetch = vi.fn().mockResolvedValue(mockFetchResponse("ok"));

      await api.queryExportBinary(42, "xlsx");

      const call = (globalThis.fetch as any).mock.calls[0];
      expect(call[1].body.get("parameters")).toBeNull();
    });

    it("detects error in response body", async () => {
      const client = new MetabaseClient(makeProfile());
      const api = new CardApi(client);
      const errorBody = JSON.stringify({
        status: "failed",
        error: "permission denied",
      });

      globalThis.fetch = vi.fn().mockResolvedValue(mockFetchResponse(errorBody));

      await expect(api.queryExportBinary(42, "csv")).rejects.toThrow(
        "Query failed: permission denied",
      );
    });

    it("throws on HTTP error", async () => {
      const client = new MetabaseClient(makeProfile());
      const api = new CardApi(client);

      globalThis.fetch = vi.fn().mockResolvedValue(mockFetchResponse("forbidden", false, 403));

      await expect(api.queryExportBinary(42, "xlsx")).rejects.toThrow("Export failed: 403");
    });
  });

  describe("checkExportError", () => {
    it("throws on JSON error body for CSV format", () => {
      const buf = Buffer.from(JSON.stringify({ status: "failed", error: "bad query" }));
      expect(() => checkExportError(buf, "csv")).toThrow("Query failed: bad query");
    });

    it("throws on JSON error body for XLSX format", () => {
      const buf = Buffer.from(JSON.stringify({ status: "failed", error: "no access" }));
      expect(() => checkExportError(buf, "xlsx")).toThrow("Query failed: no access");
    });

    it("skips check for JSON format", () => {
      const buf = Buffer.from(JSON.stringify({ status: "failed", error: "oops" }));
      expect(() => checkExportError(buf, "json")).not.toThrow();
    });

    it("does not throw for valid CSV data", () => {
      const buf = Buffer.from("id,name\n1,Alice");
      expect(() => checkExportError(buf, "csv")).not.toThrow();
    });

    it("does not throw for empty buffer", () => {
      const buf = Buffer.alloc(0);
      expect(() => checkExportError(buf, "csv")).not.toThrow();
    });

    it("throws with 'unknown error' when error field is missing", () => {
      const buf = Buffer.from(JSON.stringify({ status: "failed" }));
      expect(() => checkExportError(buf, "csv")).toThrow("Query failed: unknown error");
    });
  });

  describe("EXT_TO_FORMAT", () => {
    it("maps common extensions", () => {
      expect(EXT_TO_FORMAT[".csv"]).toBe("csv");
      expect(EXT_TO_FORMAT[".json"]).toBe("json");
      expect(EXT_TO_FORMAT[".xlsx"]).toBe("xlsx");
      expect(EXT_TO_FORMAT[".tsv"]).toBe("tsv");
    });

    it("returns undefined for unknown extensions", () => {
      expect(EXT_TO_FORMAT[".txt"]).toBeUndefined();
      expect(EXT_TO_FORMAT[".pdf"]).toBeUndefined();
    });
  });
});

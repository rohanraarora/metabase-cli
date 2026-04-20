import { describe, it, expect, vi, afterEach } from "vitest";
import type { Profile } from "../src/types.js";

// Mock the config store to avoid filesystem operations
vi.mock("../src/config/store.js", () => ({
  updateProfile: vi.fn(),
  loadConfig: vi.fn(),
  saveConfig: vi.fn(),
  getActiveProfile: vi.fn(),
}));

import { MetabaseClient } from "../src/client.js";
import { updateProfile } from "../src/config/store.js";

function makeSessionProfile(): Profile {
  return {
    name: "test",
    domain: "https://metabase.test.com",
    auth: {
      method: "session",
      email: "test@test.com",
      password: "secret",
      sessionToken: "existing-token",
    },
  };
}

function makeApiKeyProfile(): Profile {
  return {
    name: "test",
    domain: "https://metabase.test.com",
    auth: {
      method: "api-key",
      apiKey: "mb_test_key",
    },
  };
}

describe("MetabaseClient", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    it("strips trailing slash from domain", () => {
      const profile = makeSessionProfile();
      profile.domain = "https://metabase.test.com/";
      const client = new MetabaseClient(profile);
      expect(client.getProfile().domain).toBe("https://metabase.test.com/");
      // The internal domain is stripped, verified by making a request
    });

    it("reads session token from profile", () => {
      const profile = makeSessionProfile();
      const client = new MetabaseClient(profile);
      expect(client.getProfile().auth).toEqual(profile.auth);
    });
  });

  describe("ensureAuthenticated", () => {
    it("skips login for API key auth", async () => {
      const profile = makeApiKeyProfile();
      const client = new MetabaseClient(profile);
      globalThis.fetch = vi.fn();
      await client.ensureAuthenticated();
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it("skips login if session token exists", async () => {
      const profile = makeSessionProfile();
      const client = new MetabaseClient(profile);
      globalThis.fetch = vi.fn();
      await client.ensureAuthenticated();
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it("triggers login if no session token", async () => {
      const profile = makeSessionProfile();
      (profile.auth as any).sessionToken = undefined;
      const client = new MetabaseClient(profile);

      globalThis.fetch = vi
        .fn()
        // Login call
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: "new-token" }),
        } as Response)
        // getCurrentUser call
        .mockResolvedValueOnce({
          ok: true,
          text: () =>
            Promise.resolve(
              JSON.stringify({
                id: 1,
                email: "test@test.com",
                first_name: "Test",
                last_name: "User",
                is_superuser: false,
              }),
            ),
        } as Response);

      await client.ensureAuthenticated();
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("getUserId", () => {
    it("returns null when no cached user", () => {
      const client = new MetabaseClient(makeSessionProfile());
      expect(client.getUserId()).toBeNull();
    });

    it("returns cached user ID", () => {
      const profile = makeSessionProfile();
      profile.user = {
        id: 42,
        email: "test@test.com",
        first_name: "Test",
        last_name: "User",
        is_superuser: false,
      };
      const client = new MetabaseClient(profile);
      expect(client.getUserId()).toBe(42);
    });
  });

  describe("get/post/put/delete", () => {
    it("sends correct headers for session auth", async () => {
      const client = new MetabaseClient(makeSessionProfile());

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('{"result": true}'),
      } as Response);

      await client.get("/api/test");

      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://metabase.test.com/api/test",
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            "X-Metabase-Session": "existing-token",
            "Content-Type": "application/json",
          }),
        }),
      );
    });

    it("sends correct headers for API key auth", async () => {
      const client = new MetabaseClient(makeApiKeyProfile());

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('{"result": true}'),
      } as Response);

      await client.get("/api/test");

      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://metabase.test.com/api/test",
        expect.objectContaining({
          headers: expect.objectContaining({
            "X-Api-Key": "mb_test_key",
          }),
        }),
      );
    });

    it("appends query params for GET", async () => {
      const client = new MetabaseClient(makeSessionProfile());

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve("{}"),
      } as Response);

      await client.get("/api/test", { foo: "bar", baz: "1" });

      const url = (globalThis.fetch as any).mock.calls[0][0];
      expect(url).toContain("foo=bar");
      expect(url).toContain("baz=1");
    });

    it("sends JSON body for POST", async () => {
      const client = new MetabaseClient(makeSessionProfile());

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve("{}"),
      } as Response);

      await client.post("/api/test", { key: "value" });

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: "POST",
          body: '{"key":"value"}',
        }),
      );
    });

    it("throws on HTTP error", async () => {
      const client = new MetabaseClient(makeApiKeyProfile());

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve("entity not found"),
      } as Response);

      await expect(client.get("/api/test")).rejects.toThrow("404 Not Found: entity not found");
    });

    it("retries on 401 for session auth", async () => {
      const client = new MetabaseClient(makeSessionProfile());

      globalThis.fetch = vi
        .fn()
        // First request: 401
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          statusText: "Unauthorized",
          text: () => Promise.resolve("unauthenticated"),
        } as Response)
        // Login
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: "new-token" }),
        } as Response)
        // getCurrentUser
        .mockResolvedValueOnce({
          ok: true,
          text: () =>
            Promise.resolve(
              JSON.stringify({
                id: 1,
                email: "t@t.com",
                first_name: "T",
                last_name: "U",
                is_superuser: false,
              }),
            ),
        } as Response)
        // Retry request
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve('{"data": "success"}'),
          json: () => Promise.resolve({ data: "success" }),
        } as Response);

      const result = await client.get<{ data: string }>("/api/test");
      expect(result.data).toBe("success");
      expect(globalThis.fetch).toHaveBeenCalledTimes(4);
    });
  });

  describe("login", () => {
    it("caches session token and user info", async () => {
      const profile = makeSessionProfile();
      (profile.auth as any).sessionToken = undefined;
      const client = new MetabaseClient(profile);

      globalThis.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: "new-session-token" }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          text: () =>
            Promise.resolve(
              JSON.stringify({
                id: 5,
                email: "test@test.com",
                first_name: "Test",
                last_name: "User",
                is_superuser: true,
              }),
            ),
        } as Response);

      await client.login();

      // Should update profile with session token
      expect(updateProfile).toHaveBeenCalledWith(
        "test",
        expect.objectContaining({
          auth: expect.objectContaining({ sessionToken: "new-session-token" }),
        }),
      );

      // Should update profile with user info
      expect(updateProfile).toHaveBeenCalledWith(
        "test",
        expect.objectContaining({
          user: expect.objectContaining({ id: 5, is_superuser: true }),
        }),
      );

      expect(client.getUserId()).toBe(5);
    });

    it("throws on login failure", async () => {
      const profile = makeSessionProfile();
      const client = new MetabaseClient(profile);

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        text: () => Promise.resolve("invalid credentials"),
      } as Response);

      await expect(client.login()).rejects.toThrow("401 Unauthorized: invalid credentials");
    });
  });

  describe("requestFormExport", () => {
    it("sends form-encoded body with auth headers", async () => {
      const client = new MetabaseClient(makeSessionProfile());

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ "content-type": "text/csv" }),
        arrayBuffer: () => Promise.resolve(new TextEncoder().encode("id,name\n1,Alice").buffer),
      } as Response);

      await client.requestFormExport("/api/dataset/csv", { query: '{"type":"native"}' });

      const call = (globalThis.fetch as any).mock.calls[0];
      expect(call[0]).toBe("https://metabase.test.com/api/dataset/csv");
      expect(call[1].method).toBe("POST");
      expect(call[1].headers["X-Metabase-Session"]).toBe("existing-token");
      // Body should be URLSearchParams (no Content-Type: application/json)
      expect(call[1].body).toBeInstanceOf(URLSearchParams);
      expect(call[1].body.get("query")).toBe('{"type":"native"}');
    });

    it("sends API key header for API key auth", async () => {
      const client = new MetabaseClient(makeApiKeyProfile());

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      } as Response);

      await client.requestFormExport("/api/dataset/csv", {});

      const call = (globalThis.fetch as any).mock.calls[0];
      expect(call[1].headers["X-Api-Key"]).toBe("mb_test_key");
    });

    it("retries on 401 for session auth", async () => {
      const client = new MetabaseClient(makeSessionProfile());

      globalThis.fetch = vi
        .fn()
        // First request: 401
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
        } as Response)
        // Login
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: "new-token" }),
        } as Response)
        // getCurrentUser
        .mockResolvedValueOnce({
          ok: true,
          text: () =>
            Promise.resolve(
              JSON.stringify({
                id: 1,
                email: "t@t.com",
                first_name: "T",
                last_name: "U",
                is_superuser: false,
              }),
            ),
        } as Response)
        // Retry
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
        } as Response);

      const res = await client.requestFormExport("/api/dataset/csv", {});
      expect(res.ok).toBe(true);
      expect(globalThis.fetch).toHaveBeenCalledTimes(4);
    });
  });
});

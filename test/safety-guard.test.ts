import { describe, it, expect, vi, beforeEach } from "vitest";
import { SafetyGuard } from "../src/safety/guard.js";
import type { MetabaseClient } from "../src/client.js";

function mockClient(userId: number | null, entityCreatorId: number): MetabaseClient {
  return {
    getUserId: () => userId,
    get: vi.fn().mockResolvedValue({ creator_id: entityCreatorId }),
  } as unknown as MetabaseClient;
}

describe("SafetyGuard", () => {
  describe("checkOwnership", () => {
    it("returns owned=true when creator matches user", async () => {
      const client = mockClient(42, 42);
      const guard = new SafetyGuard(client);
      const result = await guard.checkOwnership("card", 1);
      expect(result.owned).toBe(true);
      expect(result.creatorId).toBe(42);
    });

    it("returns owned=false when creator does not match", async () => {
      const client = mockClient(42, 99);
      const guard = new SafetyGuard(client);
      const result = await guard.checkOwnership("card", 1);
      expect(result.owned).toBe(false);
      expect(result.creatorId).toBe(99);
    });

    it("throws when no cached user ID", async () => {
      const client = mockClient(null, 42);
      const guard = new SafetyGuard(client);
      await expect(guard.checkOwnership("card", 1)).rejects.toThrow("No cached user ID");
    });

    it("throws for unknown entity type", async () => {
      const client = mockClient(42, 42);
      const guard = new SafetyGuard(client);
      await expect(guard.checkOwnership("unknown", 1)).rejects.toThrow("Unknown entity type");
    });

    it("fetches the correct API path for each entity type", async () => {
      const client = mockClient(42, 42);
      const guard = new SafetyGuard(client);

      await guard.checkOwnership("card", 5);
      expect(client.get).toHaveBeenCalledWith("/api/card/5");

      await guard.checkOwnership("dashboard", 10);
      expect(client.get).toHaveBeenCalledWith("/api/dashboard/10");

      await guard.checkOwnership("snippet", 3);
      expect(client.get).toHaveBeenCalledWith("/api/native-query-snippet/3");

      await guard.checkOwnership("collection", 7);
      expect(client.get).toHaveBeenCalledWith("/api/collection/7");
    });
  });

  describe("guard", () => {
    it("allows action when user owns entity", async () => {
      const client = mockClient(42, 42);
      const guard = new SafetyGuard(client);
      const fn = vi.fn().mockResolvedValue("result");

      const result = await guard.guard("card", 1, "update", fn);
      expect(fn).toHaveBeenCalled();
      expect(result).toBe("result");
    });

    it("blocks action when user does not own entity", async () => {
      const client = mockClient(42, 99);
      const guard = new SafetyGuard(client);
      const fn = vi.fn();

      await expect(guard.guard("card", 1, "update", fn)).rejects.toThrow(
        "Safe mode: Cannot update card #1",
      );
      expect(fn).not.toHaveBeenCalled();
    });

    it("allows action in unsafe mode regardless of ownership", async () => {
      const client = mockClient(42, 99);
      const guard = new SafetyGuard(client, true);
      const fn = vi.fn().mockResolvedValue("result");

      const result = await guard.guard("card", 1, "update", fn);
      expect(fn).toHaveBeenCalled();
      expect(result).toBe("result");
      // Should not even check ownership
      expect(client.get).not.toHaveBeenCalled();
    });
  });
});

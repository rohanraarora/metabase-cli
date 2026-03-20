import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

// We need a mutable reference that survives vi.mock hoisting
const testState = { tmpDir: "" };

vi.mock("node:os", async () => {
  const actual = await vi.importActual<typeof import("node:os")>("node:os");
  return {
    ...actual,
    homedir: () => testState.tmpDir,
  };
});

import {
  loadConfig,
  saveConfig,
  addProfile,
  removeProfile,
  getActiveProfile,
  setActiveProfile,
  listProfiles,
  updateProfile,
} from "../src/config/store.js";
import type { Profile, Config } from "../src/types.js";

function makeProfile(name: string, overrides?: Partial<Profile>): Profile {
  return {
    name,
    domain: `https://${name}.example.com`,
    auth: { method: "session", email: "test@test.com", password: "pass" },
    ...overrides,
  };
}

describe("Config Store", () => {
  beforeEach(() => {
    testState.tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "metabase-cli-test-"));
  });

  afterEach(() => {
    fs.rmSync(testState.tmpDir, { recursive: true, force: true });
  });

  describe("loadConfig", () => {
    it("returns default config when no file exists", () => {
      const config = loadConfig();
      expect(config).toEqual({ activeProfile: "", profiles: {} });
    });

    it("reads existing config file", () => {
      const configDir = path.join(testState.tmpDir, ".metabase-cli");
      fs.mkdirSync(configDir, { recursive: true });
      const data: Config = {
        activeProfile: "test",
        profiles: { test: makeProfile("test") },
      };
      fs.writeFileSync(path.join(configDir, "config.json"), JSON.stringify(data));

      const config = loadConfig();
      expect(config.activeProfile).toBe("test");
      expect(config.profiles.test.name).toBe("test");
    });
  });

  describe("addProfile", () => {
    it("adds a profile and sets it as active if first", () => {
      addProfile(makeProfile("prod"));
      const config = loadConfig();
      expect(config.activeProfile).toBe("prod");
      expect(config.profiles.prod.domain).toBe("https://prod.example.com");
    });

    it("does not change active profile if one already exists", () => {
      addProfile(makeProfile("prod"));
      addProfile(makeProfile("staging"));
      const config = loadConfig();
      expect(config.activeProfile).toBe("prod");
      expect(Object.keys(config.profiles)).toEqual(["prod", "staging"]);
    });
  });

  describe("removeProfile", () => {
    it("removes a profile", () => {
      addProfile(makeProfile("prod"));
      addProfile(makeProfile("staging"));
      removeProfile("staging");
      const config = loadConfig();
      expect(Object.keys(config.profiles)).toEqual(["prod"]);
    });

    it("switches active profile when removing the active one", () => {
      addProfile(makeProfile("prod"));
      addProfile(makeProfile("staging"));
      setActiveProfile("staging");
      removeProfile("staging");
      const config = loadConfig();
      expect(config.activeProfile).toBe("prod");
    });

    it("clears active profile when removing the last one", () => {
      addProfile(makeProfile("prod"));
      removeProfile("prod");
      const config = loadConfig();
      expect(config.activeProfile).toBe("");
    });

    it("throws when removing nonexistent profile", () => {
      expect(() => removeProfile("nope")).toThrow('Profile "nope" does not exist');
    });
  });

  describe("setActiveProfile", () => {
    it("switches the active profile", () => {
      addProfile(makeProfile("prod"));
      addProfile(makeProfile("staging"));
      setActiveProfile("staging");
      const config = loadConfig();
      expect(config.activeProfile).toBe("staging");
    });

    it("throws when switching to nonexistent profile", () => {
      expect(() => setActiveProfile("nope")).toThrow('Profile "nope" does not exist');
    });
  });

  describe("getActiveProfile", () => {
    it("returns null when no profiles exist", () => {
      expect(getActiveProfile()).toBeNull();
    });

    it("returns the active profile", () => {
      addProfile(makeProfile("prod"));
      const profile = getActiveProfile();
      expect(profile?.name).toBe("prod");
    });
  });

  describe("listProfiles", () => {
    it("returns empty list when no profiles", () => {
      const result = listProfiles();
      expect(result.profiles).toEqual([]);
      expect(result.active).toBe("");
    });

    it("returns all profiles with active indicator", () => {
      addProfile(makeProfile("prod"));
      addProfile(makeProfile("staging"));
      const result = listProfiles();
      expect(result.profiles).toHaveLength(2);
      expect(result.active).toBe("prod");
    });
  });

  describe("updateProfile", () => {
    it("updates profile fields", () => {
      addProfile(makeProfile("prod"));
      updateProfile("prod", {
        user: {
          id: 1,
          email: "test@test.com",
          first_name: "Test",
          last_name: "User",
          is_superuser: false,
        },
      });
      const profile = getActiveProfile();
      expect(profile?.user?.id).toBe(1);
      expect(profile?.user?.first_name).toBe("Test");
    });

    it("throws when updating nonexistent profile", () => {
      expect(() => updateProfile("nope", {})).toThrow('Profile "nope" does not exist');
    });
  });
});

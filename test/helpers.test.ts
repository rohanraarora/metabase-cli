import { describe, it, expect, vi, afterEach } from "vitest";
import { writeFileSync, unlinkSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// Mock the config store (required by helpers.ts imports)
vi.mock("../src/config/store.js", () => ({
  updateProfile: vi.fn(),
  loadConfig: vi.fn(),
  saveConfig: vi.fn(),
  getActiveProfile: vi.fn(),
  getProfile: vi.fn(),
}));

import { resolveInput, resolveProfile } from "../src/commands/helpers.js";
import { getActiveProfile, getProfile } from "../src/config/store.js";

describe("resolveInput", () => {
  let tmpDir: string;
  const createdFiles: string[] = [];

  function createTmpFile(name: string, content: string): string {
    if (!tmpDir) tmpDir = mkdtempSync(join(tmpdir(), "metabase-cli-test-"));
    const filePath = join(tmpDir, name);
    writeFileSync(filePath, content, "utf-8");
    createdFiles.push(filePath);
    return filePath;
  }

  afterEach(() => {
    for (const f of createdFiles) {
      try {
        unlinkSync(f);
      } catch {
        // ignore
      }
    }
    createdFiles.length = 0;
  });

  it("returns inline value when only inline is provided", () => {
    const result = resolveInput("SELECT 1", undefined, "sql", "sql-file");
    expect(result).toBe("SELECT 1");
  });

  it("reads file content when only file path is provided", () => {
    const filePath = createTmpFile("test.sql", "SELECT * FROM users\n");
    const result = resolveInput(undefined, filePath, "sql", "sql-file");
    expect(result).toBe("SELECT * FROM users");
  });

  it("trims whitespace from file content", () => {
    const filePath = createTmpFile("whitespace.sql", "  SELECT 1  \n\n");
    const result = resolveInput(undefined, filePath, "sql", "sql-file");
    expect(result).toBe("SELECT 1");
  });

  it("reads multi-line SQL from file", () => {
    const sql = "SELECT\n  id,\n  name\nFROM users\nWHERE active = true";
    const filePath = createTmpFile("multiline.sql", sql + "\n");
    const result = resolveInput(undefined, filePath, "sql", "sql-file");
    expect(result).toBe(sql);
  });

  it("reads JSON from file", () => {
    const json = '{"filter": [">", ["field", 10], 100]}';
    const filePath = createTmpFile("def.json", json);
    const result = resolveInput(undefined, filePath, "definition", "definition-file");
    expect(JSON.parse(result)).toEqual({ filter: [">", ["field", 10], 100] });
  });

  it("exits with error when both inline and file are provided", () => {
    const mockExit = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit");
    });
    const mockError = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => resolveInput("SELECT 1", "/tmp/f.sql", "sql", "sql-file")).toThrow("process.exit");
    expect(mockError).toHaveBeenCalledWith("Error: --sql and --sql-file are mutually exclusive.");

    mockExit.mockRestore();
    mockError.mockRestore();
  });

  it("exits with error when neither inline nor file are provided", () => {
    const mockExit = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit");
    });
    const mockError = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => resolveInput(undefined, undefined, "sql", "sql-file")).toThrow("process.exit");
    expect(mockError).toHaveBeenCalledWith("Error: either --sql or --sql-file is required.");

    mockExit.mockRestore();
    mockError.mockRestore();
  });

  it("throws when file does not exist", () => {
    expect(() => resolveInput(undefined, "/nonexistent/path.sql", "sql", "sql-file")).toThrow();
  });
});

describe("resolveProfile", () => {
  const ENV_BACKUP: Record<string, string | undefined> = {};

  function setEnv(vars: Record<string, string | undefined>) {
    for (const [key, val] of Object.entries(vars)) {
      ENV_BACKUP[key] = process.env[key];
      if (val === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = val;
      }
    }
  }

  afterEach(() => {
    for (const [key, val] of Object.entries(ENV_BACKUP)) {
      if (val === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = val;
      }
    }
    vi.restoreAllMocks();
  });

  it("returns ephemeral profile when both env vars are set", () => {
    setEnv({
      _METABASE_CLI_PROFILE: undefined,
      METABASE_CLI_AUTH_KEY: "mb_test_key",
      METABASE_CLI_DOMAIN: "https://mb.example.com",
    });

    const profile = resolveProfile();
    expect(profile).toEqual({
      name: "__env__",
      domain: "https://mb.example.com",
      auth: { method: "api-key", apiKey: "mb_test_key" },
    });
  });

  it("--profile flag takes precedence over env vars", () => {
    const savedProfile = {
      name: "prod",
      domain: "https://prod.example.com",
      auth: { method: "api-key" as const, apiKey: "mb_prod" },
    };
    vi.mocked(getProfile).mockReturnValue(savedProfile);

    setEnv({
      _METABASE_CLI_PROFILE: "prod",
      METABASE_CLI_AUTH_KEY: "mb_env_key",
      METABASE_CLI_DOMAIN: "https://env.example.com",
    });

    const profile = resolveProfile();
    expect(profile).toEqual(savedProfile);
  });

  it("warns when only METABASE_CLI_AUTH_KEY is set", () => {
    const mockWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(getActiveProfile).mockReturnValue(null);

    setEnv({
      _METABASE_CLI_PROFILE: undefined,
      METABASE_CLI_AUTH_KEY: "mb_key",
      METABASE_CLI_DOMAIN: undefined,
    });

    resolveProfile();
    expect(mockWarn).toHaveBeenCalledWith(
      expect.stringContaining("METABASE_CLI_DOMAIN is missing"),
    );
  });

  it("warns when only METABASE_CLI_DOMAIN is set", () => {
    const mockWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(getActiveProfile).mockReturnValue(null);

    setEnv({
      _METABASE_CLI_PROFILE: undefined,
      METABASE_CLI_AUTH_KEY: undefined,
      METABASE_CLI_DOMAIN: "https://mb.example.com",
    });

    resolveProfile();
    expect(mockWarn).toHaveBeenCalledWith(
      expect.stringContaining("METABASE_CLI_AUTH_KEY is missing"),
    );
  });

  it("falls back to active profile when no env vars are set", () => {
    const activeProfile = {
      name: "default",
      domain: "https://default.example.com",
      auth: { method: "api-key" as const, apiKey: "mb_default" },
    };
    vi.mocked(getActiveProfile).mockReturnValue(activeProfile);

    setEnv({
      _METABASE_CLI_PROFILE: undefined,
      METABASE_CLI_AUTH_KEY: undefined,
      METABASE_CLI_DOMAIN: undefined,
    });

    const profile = resolveProfile();
    expect(profile).toEqual(activeProfile);
  });
});

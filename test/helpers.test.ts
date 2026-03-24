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

import { resolveInput } from "../src/commands/helpers.js";

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

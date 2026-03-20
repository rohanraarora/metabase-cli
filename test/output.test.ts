import { describe, it, expect } from "vitest";
import { formatDatasetResponse, formatEntityTable, formatJson } from "../src/utils/output.js";
import type { DatasetResponse } from "../src/types.js";

function makeDataset(
  cols: { name: string; display_name: string; base_type: string }[],
  rows: unknown[][],
): DatasetResponse {
  return {
    data: { cols, rows },
    row_count: rows.length,
    status: "completed",
  };
}

describe("Output Formatting", () => {
  const dataset = makeDataset(
    [
      { name: "id", display_name: "ID", base_type: "type/Integer" },
      { name: "name", display_name: "Name", base_type: "type/Text" },
      { name: "email", display_name: "Email", base_type: "type/Text" },
    ],
    [
      [1, "Alice", "alice@example.com"],
      [2, "Bob", "bob@example.com"],
      [3, null, "charlie@example.com"],
    ],
  );

  describe("formatDatasetResponse", () => {
    it("formats as JSON", () => {
      const result = formatDatasetResponse(dataset, "json");
      const parsed = JSON.parse(result);
      expect(parsed).toHaveLength(3);
      expect(parsed[0]).toEqual({ id: 1, name: "Alice", email: "alice@example.com" });
      expect(parsed[2].name).toBeNull();
    });

    it("formats as CSV", () => {
      const result = formatDatasetResponse(dataset, "csv");
      const lines = result.split("\n");
      expect(lines[0]).toBe("id,name,email");
      expect(lines[1]).toBe("1,Alice,alice@example.com");
      expect(lines[3]).toBe("3,,charlie@example.com");
    });

    it("formats as TSV", () => {
      const result = formatDatasetResponse(dataset, "tsv");
      const lines = result.split("\n");
      expect(lines[0]).toBe("id\tname\temail");
      expect(lines[1]).toBe("1\tAlice\talice@example.com");
    });

    it("formats as table (default)", () => {
      const result = formatDatasetResponse(dataset, "table");
      expect(result).toContain("ID");
      expect(result).toContain("Name");
      expect(result).toContain("Alice");
      expect(result).toContain("Bob");
    });

    it("filters columns when specified", () => {
      const result = formatDatasetResponse(dataset, "json", ["id", "name"]);
      const parsed = JSON.parse(result);
      expect(Object.keys(parsed[0])).toEqual(["id", "name"]);
    });

    it("throws for unknown column name", () => {
      expect(() => formatDatasetResponse(dataset, "json", ["nonexistent"])).toThrow(
        'Column "nonexistent" not found',
      );
    });

    it("escapes CSV fields with commas", () => {
      const ds = makeDataset(
        [{ name: "val", display_name: "Val", base_type: "type/Text" }],
        [["hello, world"]],
      );
      const result = formatDatasetResponse(ds, "csv");
      expect(result).toContain('"hello, world"');
    });

    it("escapes CSV fields with quotes", () => {
      const ds = makeDataset(
        [{ name: "val", display_name: "Val", base_type: "type/Text" }],
        [['say "hi"']],
      );
      const result = formatDatasetResponse(ds, "csv");
      expect(result).toContain('"say ""hi"""');
    });
  });

  describe("formatEntityTable", () => {
    it("formats entities as ASCII table", () => {
      const items = [
        { id: 1, name: "Dashboard A" },
        { id: 2, name: "Dashboard B" },
      ];
      const result = formatEntityTable(items, [
        { key: "id", header: "ID" },
        { key: "name", header: "Name" },
      ]);
      expect(result).toContain("ID");
      expect(result).toContain("Name");
      expect(result).toContain("Dashboard A");
      expect(result).toContain("Dashboard B");
    });

    it("handles null/undefined values", () => {
      const items = [{ id: 1, name: null }];
      const result = formatEntityTable(items as any[], [
        { key: "id", header: "ID" },
        { key: "name", header: "Name" },
      ]);
      expect(result).toContain("1");
    });
  });

  describe("formatJson", () => {
    it("pretty-prints JSON", () => {
      const result = formatJson({ a: 1, b: [2, 3] });
      expect(result).toBe('{\n  "a": 1,\n  "b": [\n    2,\n    3\n  ]\n}');
    });
  });
});

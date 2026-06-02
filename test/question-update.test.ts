import { describe, it, expect } from "vitest";
import { applyDatabaseToDatasetQuery, buildDatasetQueryUpdate } from "../src/commands/question.js";
import type { DatasetQuery } from "../src/types.js";

// Regression coverage for the bug where updating a v0.59+ card with template
// tags left the card unrunnable ("Card does not have a template tag named X").
// The bug was caused by wrapping `stages[0].native` as an object
// `{query, template-tags}` — v0.59+ requires `native` to stay a string and
// `template-tags` to live at the stage level.

describe("buildDatasetQueryUpdate — v0.59+ stages shape", () => {
  const tags = {
    since_date: {
      id: "abc-123",
      name: "since_date",
      "display-name": "Since Date",
      type: "date",
    },
  };

  it("keeps stages[0].native as a STRING when template tags are provided", () => {
    const existing: DatasetQuery = {
      type: "native",
      database: 16,
      stages: [{ "lib/type": "mbql.stage/native", native: "SELECT 1" }],
    };

    const out = buildDatasetQueryUpdate(existing, "SELECT {{since_date}}", tags);

    const stage = out.stages![0];
    expect(typeof stage.native).toBe("string");
    expect(stage.native).toBe("SELECT {{since_date}}");
    expect((stage as any)["template-tags"]).toEqual(tags);
    // native must not carry a nested template-tags — that's the corruption path.
    expect(stage.native).not.toHaveProperty("template-tags");
  });

  it("places template-tags at the stage level, not inside native", () => {
    const existing: DatasetQuery = {
      type: "native",
      database: 16,
      stages: [{ "lib/type": "mbql.stage/native", native: "SELECT 1" }],
    };

    const out = buildDatasetQueryUpdate(existing, undefined, tags);

    expect((out.stages![0] as any)["template-tags"]).toEqual(tags);
    expect(typeof out.stages![0].native).toBe("string");
  });

  it("SQL-only update preserves existing stage-level template-tags", () => {
    const existing: DatasetQuery = {
      type: "native",
      database: 16,
      stages: [
        {
          "lib/type": "mbql.stage/native",
          "template-tags": tags,
          native: "SELECT {{since_date}}",
        },
      ],
    };

    const out = buildDatasetQueryUpdate(existing, "SELECT {{since_date}} AS d", undefined);

    expect(out.stages![0].native).toBe("SELECT {{since_date}} AS d");
    expect((out.stages![0] as any)["template-tags"]).toEqual(tags);
  });

  it("heals a card that was already corrupted by a prior buggy update", () => {
    // Simulates the exact shape the bug left behind: stage-level tags PLUS a
    // nested native object that also carries template-tags. The helper should
    // flatten native back to a string and overwrite with the new tags.
    const corrupt: DatasetQuery = {
      type: "native",
      database: 16,
      stages: [
        {
          "lib/type": "mbql.stage/native",
          "template-tags": { stale: { id: "old", name: "stale", type: "text" } },
          native: {
            query: "SELECT {{since_date}}",
            "template-tags": {
              since_date: { id: "dup", name: "since_date", type: "date" },
            },
          },
        },
      ],
    };

    const out = buildDatasetQueryUpdate(corrupt, "SELECT {{since_date}} AS d", tags);

    expect(out.stages![0].native).toBe("SELECT {{since_date}} AS d");
    expect((out.stages![0] as any)["template-tags"]).toEqual(tags);
  });

  it("unwraps a nested-object native when rebuilding on SQL-only update", () => {
    const corrupt: DatasetQuery = {
      type: "native",
      database: 16,
      stages: [
        {
          "lib/type": "mbql.stage/native",
          native: { query: "SELECT 1", "template-tags": {} },
        },
      ],
    };

    const out = buildDatasetQueryUpdate(corrupt, "SELECT 2", undefined);

    expect(out.stages![0].native).toBe("SELECT 2");
  });
});

describe("buildDatasetQueryUpdate — legacy (pre-v0.59) shape", () => {
  const tags = {
    id: {
      id: "xyz",
      name: "id",
      "display-name": "ID",
      type: "number",
    },
  };

  it("keeps native as an object with {query, template-tags}", () => {
    const existing: DatasetQuery = {
      type: "native",
      database: 2,
      native: { query: "SELECT 1" },
    };

    const out = buildDatasetQueryUpdate(existing, "SELECT {{id}}", tags);

    expect(out.native).toEqual({ query: "SELECT {{id}}", "template-tags": tags });
    expect(out.stages).toBeUndefined();
  });

  it("SQL-only update preserves existing legacy template-tags", () => {
    const existing: DatasetQuery = {
      type: "native",
      database: 2,
      native: { query: "SELECT {{id}}", "template-tags": tags },
    };

    const out = buildDatasetQueryUpdate(existing, "SELECT {{id}} AS x", undefined);

    expect(out.native).toEqual({ query: "SELECT {{id}} AS x", "template-tags": tags });
  });
});

// Regression coverage for the `question update --db <id>` flag. Without
// updating dataset_query.database alongside the top-level database_id, the
// card runs against the original database even after the PUT succeeds.
describe("applyDatabaseToDatasetQuery", () => {
  it("overrides the top-level database field on a v0.59+ stages dataset_query", () => {
    const existing: DatasetQuery = {
      type: "native",
      database: 16,
      stages: [{ "lib/type": "mbql.stage/native", native: "SELECT 1" }],
    };

    const out = applyDatabaseToDatasetQuery(existing, 35);

    expect(out.database).toBe(35);
    expect(out.stages).toEqual(existing.stages);
    expect(out.type).toBe("native");
  });

  it("overrides the top-level database field on a legacy native dataset_query", () => {
    const existing: DatasetQuery = {
      type: "native",
      database: 2,
      native: { query: "SELECT 1", "template-tags": {} },
    };

    const out = applyDatabaseToDatasetQuery(existing, 14);

    expect(out.database).toBe(14);
    expect(out.native).toEqual(existing.native);
  });

  it("does not mutate the input dataset_query", () => {
    const existing: DatasetQuery = {
      type: "native",
      database: 16,
      stages: [{ "lib/type": "mbql.stage/native", native: "SELECT 1" }],
    };

    applyDatabaseToDatasetQuery(existing, 35);

    expect(existing.database).toBe(16);
  });
});

import { Command } from "commander";
import { writeFileSync } from "node:fs";
import { resolve, extname } from "node:path";
import { CardApi } from "../api/card.js";
import { SafetyGuard } from "../safety/guard.js";
import { formatDatasetResponse, formatEntityTable, formatJson } from "../utils/output.js";
import { EXT_TO_FORMAT } from "../utils/export.js";
import { resolveClient, resolveDb, isUnsafe } from "./helpers.js";
import type { OutputFormat } from "../types.js";

const TAG_TYPE_TO_PARAM_TYPE: Record<string, string> = {
  date: "date/single",
  text: "string/=",
  number: "number/=",
};

function buildParametersFromTags(tags: Record<string, any>): unknown[] {
  if (Object.keys(tags).length === 0) return [];

  return Object.entries(tags).map(([name, tag]) => {
    const isDimension = tag.type === "dimension";
    const paramType = isDimension
      ? (tag["widget-type"] || "string/=")
      : (TAG_TYPE_TO_PARAM_TYPE[tag.type] || "string/=");

    const param: Record<string, unknown> = {
      id: tag.id || crypto.randomUUID(),
      type: paramType,
      target: isDimension
        ? ["dimension", ["template-tag", name]]
        : ["variable", ["template-tag", name]],
      name: tag["display-name"] || name,
      slug: name,
    };
    if (tag.default !== undefined) {
      param.default = tag.default;
    }
    return param;
  });
}

export function questionCommand(): Command {
  const cmd = new Command("question")
    .description("Manage questions (saved cards)")
    .addHelpText("after", `
Examples:
  $ metabase-cli question list --filter mine
  $ metabase-cli question show 42
  $ metabase-cli question run 42 --format csv
  $ metabase-cli question create --name "Active Users" --sql "SELECT * FROM users WHERE active" --db 1
  $ metabase-cli question update 42 --name "New Name" --unsafe
  $ metabase-cli question delete 42
  $ metabase-cli question copy 42 --name "Copy" --collection 5`);

  cmd
    .command("list")
    .description("List questions")
    .option("--filter <f>", "Filter: all, mine, bookmarked, archived")
    .option("--format <format>", "Output format: table, json", "table")
    .addHelpText("after", `
Examples:
  $ metabase-cli question list
  $ metabase-cli question list --filter mine
  $ metabase-cli question list --format json`)
    .action(async (opts) => {
      const client = await resolveClient();
      const api = new CardApi(client);
      const params: Record<string, string> = {};
      if (opts.filter) params.f = opts.filter;

      const cards = await api.list(params);

      if (opts.format === "json") {
        console.log(formatJson(cards));
        return;
      }

      console.log(
        formatEntityTable(cards as any[], [
          { key: "id", header: "ID" },
          { key: "name", header: "Name" },
          { key: "display", header: "Display" },
          { key: "collection_id", header: "Collection" },
          { key: "creator_id", header: "Creator" },
        ]),
      );
    });

  cmd
    .command("show <id>")
    .description("Show question details")
    .addHelpText("after", `
Examples:
  $ metabase-cli question show 42`)
    .action(async (id: string) => {
      const client = await resolveClient();
      const api = new CardApi(client);
      const card = await api.get(parseInt(id));
      console.log(formatJson(card));
    });

  cmd
    .command("run <id>")
    .description("Execute a saved question")
    .option("--format <format>", "Output format: table, json, csv, tsv, xlsx", "table")
    .option("--output <file>", "Write output to a file (format auto-detected from extension)")
    .option("--columns <cols>", "Comma-separated column names")
    .option("--params <json>", 'Parameter values as JSON, e.g. \'{"start_date":"2025-01-01"}\'')
    .addHelpText("after", `
Examples:
  $ metabase-cli question run 42
  $ metabase-cli question run 42 --format csv
  $ metabase-cli question run 42 --columns "id,name,email"
  $ metabase-cli question run 42 --params '{"start_date":"2025-01-01"}'
  $ metabase-cli question run 42 --output results.xlsx
  $ metabase-cli question run 42 --output results.csv`)
    .action(async (id: string, opts) => {
      const client = await resolveClient();
      const api = new CardApi(client);
      const cardId = parseInt(id);

      // Determine effective format
      let format: string = opts.format;
      const outputPath = opts.output ? resolve(opts.output) : null;
      if (outputPath) {
        const ext = extname(outputPath).toLowerCase();
        const inferredFormat = EXT_TO_FORMAT[ext];
        if (inferredFormat && format === "table") {
          format = inferredFormat;
        }
      }

      // Fetch card to get parameter definitions
      const card = await api.get(cardId);
      const cardParams: any[] = (card as any).parameters || [];

      // Parse user-provided param values
      let paramsInput: Record<string, unknown> = {};
      if (opts.params) {
        try { paramsInput = JSON.parse(opts.params); }
        catch { console.error("Error: --params must be valid JSON"); process.exit(1); }
      }

      // Build parameter values: use provided values, fall back to defaults
      const parameterValues = cardParams
        .map((p: any) => {
          const value = paramsInput[p.slug] ?? p.default;
          if (value === undefined) return null;
          return {
            id: p.id,
            type: p.type,
            target: p.target,
            value,
          };
        })
        .filter(Boolean);

      // When --output is used, use Metabase's native export API to bypass the 2000-row limit
      if (outputPath) {
        if (format === "xlsx" || format === "csv" || format === "json") {
          if (opts.columns) {
            console.warn("Warning: --columns is not supported with native export (csv/json/xlsx). All columns will be exported.");
          }
          const data = await api.queryExportBinary(cardId, format as "csv" | "json" | "xlsx", parameterValues);
          writeFileSync(outputPath, data);
          console.log(`Exported to ${outputPath}`);
        } else {
          // table or tsv format: query normally and format locally
          const result = await api.query(cardId, parameterValues);
          if (result.status === "failed") {
            console.error("Query failed:", (result as any).error);
            process.exit(1);
          }
          const columns = opts.columns?.split(",");
          const output = formatDatasetResponse(result, format as OutputFormat, columns);
          writeFileSync(outputPath, output, "utf-8");
          console.log(`Exported ${result.row_count} row(s) to ${outputPath}`);
        }
        return;
      }

      if (format === "xlsx") {
        console.error("Error: xlsx format requires --output <file>");
        process.exit(1);
      }

      const result = await api.query(cardId, parameterValues);

      if (result.status === "failed") {
        console.error("Query failed:", (result as any).error);
        process.exit(1);
      }

      const columns = opts.columns?.split(",");
      console.log(
        formatDatasetResponse(result, format as OutputFormat, columns),
      );
      console.log(`\n${result.row_count} row(s) returned.`);
    });

  cmd
    .command("create")
    .description("Create a new question")
    .requiredOption("--name <name>", "Question name")
    .requiredOption("--sql <sql>", "SQL query")
    .option("--db <id>", "Database ID (uses profile default if not set)", parseInt)
    .option("--description <desc>", "Description")
    .option("--collection <id>", "Collection ID", parseInt)
    .option("--display <type>", "Display type (table, line, bar, pie, scalar, etc.)", "table")
    .option("--viz <json>", "Visualization settings as JSON string")
    .option("--template-tags <json>", "Template tags as JSON string for parameterized queries")
    .addHelpText("after", `
Display types: table, line, bar, area, pie, scalar, row, scatter, funnel, map, pivot, progress, gauge, waterfall

Examples:
  $ metabase-cli question create --name "Active Users" --sql "SELECT * FROM users WHERE active = true" --db 1
  $ metabase-cli question create --name "Revenue" --sql "SELECT sum(amount) FROM orders" --db 1 --collection 5
  $ metabase-cli question create --name "Revenue Trend" --sql "SELECT date, sum(amount) FROM orders GROUP BY date" --display line
  $ metabase-cli question create --name "Revenue Trend" --sql "..." --display line --viz '{"graph.show_values":true}'
  $ metabase-cli question create --name "Users Since" --sql "SELECT * FROM users WHERE created_at >= {{start_date}}" --template-tags '{"start_date":{"type":"date","name":"start_date","display-name":"Start Date","default":"2024-01-01"}}'`)
    .action(async (opts) => {
      const client = await resolveClient();
      const api = new CardApi(client);
      const db = resolveDb(opts.db);

      let vizSettings: Record<string, unknown> = {};
      if (opts.viz) {
        try { vizSettings = JSON.parse(opts.viz); }
        catch { console.error("Error: --viz must be valid JSON"); process.exit(1); }
      }

      let templateTags: Record<string, unknown> = {};
      if (opts.templateTags) {
        try { templateTags = JSON.parse(opts.templateTags); }
        catch { console.error("Error: --template-tags must be valid JSON"); process.exit(1); }
      }

      // Auto-generate parameters from template tags
      const parameters = buildParametersFromTags(templateTags);

      const card = await api.create({
        name: opts.name,
        display: opts.display,
        description: opts.description,
        collection_id: opts.collection,
        visualization_settings: vizSettings,
        parameters,
        dataset_query: {
          type: "native",
          database: db,
          native: {
            query: opts.sql,
            "template-tags": Object.keys(templateTags).length > 0 ? templateTags : undefined,
          },
        },
      });
      console.log(`Question #${card.id} "${card.name}" created.`);
    });

  cmd
    .command("update <id>")
    .description("Update a question (safe mode by default)")
    .option("--name <name>", "New name")
    .option("--description <desc>", "New description")
    .option("--collection <id>", "Move to collection", parseInt)
    .option("--sql <sql>", "New SQL query")
    .option("--display <type>", "Change display type (table, line, bar, pie, scalar, etc.)")
    .option("--viz <json>", "Visualization settings as JSON (merged with existing)")
    .option("--unsafe", "Bypass safe mode", false)
    .addHelpText("after", `
Safe mode blocks updates to questions you didn't create. Use --unsafe to bypass.

Examples:
  $ metabase-cli question update 42 --name "New Name"
  $ metabase-cli question update 42 --sql "SELECT * FROM users WHERE active" --unsafe
  $ metabase-cli question update 42 --display line
  $ metabase-cli question update 42 --viz '{"graph.show_values":true,"graph.dimensions":["date"]}'`)
    .action(async function (this: Command, id: string, opts) {
      const client = await resolveClient();
      const api = new CardApi(client);
      const guard = new SafetyGuard(client, isUnsafe(this, opts.unsafe));
      const cardId = parseInt(id);

      await guard.guard("card", cardId, "update", async () => {
        const updates: Record<string, unknown> = {};
        if (opts.name) updates.name = opts.name;
        if (opts.description) updates.description = opts.description;
        if (opts.collection !== undefined) updates.collection_id = opts.collection;
        if (opts.display) updates.display = opts.display;
        if (opts.viz) {
          let vizSettings: Record<string, unknown>;
          try { vizSettings = JSON.parse(opts.viz); }
          catch { console.error("Error: --viz must be valid JSON"); process.exit(1); }
          // Merge with existing viz settings
          const existing = await api.get(cardId);
          updates.visualization_settings = {
            ...existing.visualization_settings,
            ...vizSettings,
          };
        }
        if (opts.sql) {
          const existing = await api.get(cardId);
          updates.dataset_query = {
            ...existing.dataset_query,
            native: {
              ...existing.dataset_query.native,
              query: opts.sql,
            },
          };
        }
        const card = await api.update(cardId, updates);
        console.log(`Question #${card.id} "${card.name}" updated.`);
      });
    });

  cmd
    .command("delete <id>")
    .description("Delete a question (safe mode by default)")
    .option("--unsafe", "Bypass safe mode", false)
    .addHelpText("after", `
Examples:
  $ metabase-cli question delete 42
  $ metabase-cli question delete 42 --unsafe`)
    .action(async function (this: Command, id: string, opts) {
      const client = await resolveClient();
      const api = new CardApi(client);
      const guard = new SafetyGuard(client, isUnsafe(this, opts.unsafe));
      const cardId = parseInt(id);

      await guard.guard("card", cardId, "delete", async () => {
        await api.delete(cardId);
        console.log(`Question #${cardId} deleted.`);
      });
    });

  cmd
    .command("copy <id>")
    .description("Copy a question")
    .option("--name <name>", "Name for the copy")
    .option("--collection <id>", "Target collection", parseInt)
    .addHelpText("after", `
Examples:
  $ metabase-cli question copy 42
  $ metabase-cli question copy 42 --name "Copy of Revenue" --collection 10`)
    .action(async (id: string, opts) => {
      const client = await resolveClient();
      const api = new CardApi(client);
      const overrides: Record<string, unknown> = {};
      if (opts.name) overrides.name = opts.name;
      if (opts.collection !== undefined) overrides.collection_id = opts.collection;
      const card = await api.copy(parseInt(id), overrides as any);
      console.log(`Question #${card.id} "${card.name}" created (copy).`);
    });

  return cmd;
}

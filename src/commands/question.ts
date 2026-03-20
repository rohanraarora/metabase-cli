import { Command } from "commander";
import { CardApi } from "../api/card.js";
import { SafetyGuard } from "../safety/guard.js";
import { formatDatasetResponse, formatEntityTable, formatJson } from "../utils/output.js";
import { resolveClient, resolveDb, isUnsafe } from "./helpers.js";
import type { OutputFormat } from "../types.js";

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
    .option("--format <format>", "Output format: table, json, csv, tsv", "table")
    .option("--columns <cols>", "Comma-separated column names")
    .addHelpText("after", `
Examples:
  $ metabase-cli question run 42
  $ metabase-cli question run 42 --format csv
  $ metabase-cli question run 42 --columns "id,name,email"`)
    .action(async (id: string, opts) => {
      const client = await resolveClient();
      const api = new CardApi(client);
      const result = await api.query(parseInt(id));

      if (result.status === "failed") {
        console.error("Query failed:", (result as any).error);
        process.exit(1);
      }

      const columns = opts.columns?.split(",");
      console.log(
        formatDatasetResponse(result, opts.format as OutputFormat, columns),
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
    .option("--display <type>", "Display type", "table")
    .addHelpText("after", `
Examples:
  $ metabase-cli question create --name "Active Users" --sql "SELECT * FROM users WHERE active = true" --db 1
  $ metabase-cli question create --name "Revenue" --sql "SELECT sum(amount) FROM orders" --db 1 --collection 5`)
    .action(async (opts) => {
      const client = await resolveClient();
      const api = new CardApi(client);
      const db = resolveDb(opts.db);
      const card = await api.create({
        name: opts.name,
        display: opts.display,
        description: opts.description,
        collection_id: opts.collection,
        dataset_query: {
          type: "native",
          database: db,
          native: { query: opts.sql },
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
    .option("--unsafe", "Bypass safe mode", false)
    .addHelpText("after", `
Safe mode blocks updates to questions you didn't create. Use --unsafe to bypass.

Examples:
  $ metabase-cli question update 42 --name "New Name"
  $ metabase-cli question update 42 --sql "SELECT * FROM users WHERE active" --unsafe`)
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
        if (opts.sql) {
          const existing = await api.get(cardId);
          updates.dataset_query = {
            ...existing.dataset_query,
            native: { query: opts.sql },
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

import { Command } from "commander";
import { DatasetApi } from "../api/dataset.js";
import { formatDatasetResponse } from "../utils/output.js";
import { resolveClient, resolveDb } from "./helpers.js";
import type { OutputFormat } from "../types.js";

export function queryCommand(): Command {
  const cmd = new Command("query")
    .description("Run queries against a database")
    .addHelpText("after", `
Examples:
  $ metabase-cli query run --sql "SELECT * FROM users LIMIT 10" --db 1
  $ metabase-cli query run --sql "SELECT count(*) FROM orders" --db 1 --format json
  $ metabase-cli query run --sql "SELECT * FROM products" --db 1 --format csv
  $ metabase-cli query run --sql "SELECT * FROM users" --db 1 --columns "id,email" --limit 5`);

  cmd
    .command("run")
    .description("Execute a SQL query")
    .requiredOption("--sql <sql>", "SQL query to execute")
    .option("--db <id>", "Database ID (uses profile default if not set)", parseInt)
    .option("--format <format>", "Output format: table, json, csv, tsv", "table")
    .option("--columns <cols>", "Comma-separated column names to display")
    .option("--limit <n>", "Limit number of rows", parseInt)
    .addHelpText("after", `
Examples:
  $ metabase-cli query run --sql "SELECT * FROM users LIMIT 10" --db 1
  $ metabase-cli query run --sql "SELECT count(*) FROM orders" --db 1 --format json
  $ metabase-cli query run --sql "SELECT * FROM products" --db 2 --format csv > products.csv`)
    .action(async (opts) => {
      const client = await resolveClient();
      const api = new DatasetApi(client);

      let sql = opts.sql;
      if (opts.limit) {
        sql = `SELECT * FROM (${sql}) _q LIMIT ${opts.limit}`;
      }

      const db = resolveDb(opts.db);
      const result = await api.queryNative(db, sql);

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

  return cmd;
}

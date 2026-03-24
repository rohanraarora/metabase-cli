import { Command } from "commander";
import { writeFileSync } from "node:fs";
import { resolve, extname } from "node:path";
import { DatasetApi } from "../api/dataset.js";
import { formatDatasetResponse } from "../utils/output.js";
import { EXT_TO_FORMAT } from "../utils/export.js";
import { resolveClient, resolveDb, resolveInput } from "./helpers.js";
import type { OutputFormat } from "../types.js";

export function queryCommand(): Command {
  const cmd = new Command("query").description("Run queries against a database").addHelpText(
    "after",
    `
Examples:
  $ metabase-cli query run --sql "SELECT * FROM users LIMIT 10" --db 1
  $ metabase-cli query run --sql "SELECT count(*) FROM orders" --db 1 --format json
  $ metabase-cli query run --sql "SELECT * FROM products" --db 1 --format csv
  $ metabase-cli query run --sql "SELECT * FROM users" --db 1 --columns "id,email" --limit 5`,
  );

  cmd
    .command("run")
    .description("Execute a SQL query")
    .option("--sql <sql>", "SQL query to execute")
    .option("--sql-file <path>", "Read SQL query from a file")
    .option("--db <id>", "Database ID (uses profile default if not set)", parseInt)
    .option("--format <format>", "Output format: table, json, csv, tsv, xlsx", "table")
    .option("--output <file>", "Write output to a file (format auto-detected from extension)")
    .option("--columns <cols>", "Comma-separated column names to display")
    .option("--limit <n>", "Limit number of rows", parseInt)
    .addHelpText(
      "after",
      `
Examples:
  $ metabase-cli query run --sql "SELECT * FROM users LIMIT 10" --db 1
  $ metabase-cli query run --sql "SELECT count(*) FROM orders" --db 1 --format json
  $ metabase-cli query run --sql "SELECT * FROM products" --db 2 --format csv > products.csv
  $ metabase-cli query run --sql "SELECT * FROM products" --db 2 --output products.xlsx
  $ metabase-cli query run --sql-file query.sql --db 1
  $ metabase-cli query run --sql "SELECT * FROM products" --db 2 --output results.csv`,
    )
    .action(async (opts) => {
      const client = await resolveClient();
      const api = new DatasetApi(client);

      let sql = resolveInput(opts.sql, opts.sqlFile, "sql", "sql-file");
      if (opts.limit) {
        sql = `SELECT * FROM (${sql}) _q LIMIT ${opts.limit}`;
      }

      const db = resolveDb(opts.db);

      // Determine effective format: --output extension takes precedence over default, explicit --format wins
      let format: string = opts.format;
      const outputPath = opts.output ? resolve(opts.output) : null;
      if (outputPath) {
        const ext = extname(outputPath).toLowerCase();
        const inferredFormat = EXT_TO_FORMAT[ext];
        // Use inferred format if user didn't explicitly set --format (still default "table")
        if (inferredFormat && format === "table") {
          format = inferredFormat;
        }
      }

      // When --output is used, use Metabase's native export API to bypass the 2000-row limit
      if (outputPath) {
        if (format === "xlsx" || format === "csv" || format === "json") {
          if (opts.columns) {
            console.warn(
              "Warning: --columns is not supported with native export (csv/json/xlsx). All columns will be exported.",
            );
          }
          const datasetQuery = {
            type: "native" as const,
            database: db,
            native: { query: sql, "template-tags": {} },
          };
          const data = await api.exportBinary(datasetQuery, format as "csv" | "json" | "xlsx");
          writeFileSync(outputPath, data);
          console.log(`Exported to ${outputPath}`);
        } else {
          // table or tsv format: query normally and format locally
          const result = await api.queryNative(db, sql);
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

      const result = await api.queryNative(db, sql);

      if (result.status === "failed") {
        console.error("Query failed:", (result as any).error);
        process.exit(1);
      }

      const columns = opts.columns?.split(",");
      console.log(formatDatasetResponse(result, format as OutputFormat, columns));
      console.log(`\n${result.row_count} row(s) returned.`);
    });

  return cmd;
}

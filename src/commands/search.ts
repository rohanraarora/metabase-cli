import { Command } from "commander";
import { SearchApi } from "../api/search.js";
import { formatEntityTable, formatJson } from "../utils/output.js";
import { resolveClient } from "./helpers.js";

export function searchCommand(): Command {
  const cmd = new Command("search")
    .description("Search across all entities")
    .argument("<query>", "Search query")
    .option("--models <models>", "Filter by type: card, dashboard, collection, table, database")
    .option("--limit <n>", "Max results", parseInt)
    .option("--format <format>", "Output format: table, json", "table")
    .addHelpText(
      "after",
      `
Examples:
  $ metabase-cli search "revenue"
  $ metabase-cli search "users" --models card,dashboard
  $ metabase-cli search "orders" --limit 5 --format json`,
    )
    .action(async (query: string, opts) => {
      const client = await resolveClient();
      const api = new SearchApi(client);
      const result = await api.search(query, {
        models: opts.models?.split(","),
        limit: opts.limit,
      });

      if (opts.format === "json") {
        console.log(formatJson(result));
        return;
      }

      console.log(
        formatEntityTable(result.data as any[], [
          { key: "id", header: "ID" },
          { key: "model", header: "Type" },
          { key: "name", header: "Name" },
          { key: "description", header: "Description" },
          { key: "collection_id", header: "Collection" },
        ]),
      );
      console.log(`\n${result.total} result(s).`);
    });

  return cmd;
}

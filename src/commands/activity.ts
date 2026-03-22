import { Command } from "commander";
import { ActivityApi } from "../api/activity.js";
import { formatEntityTable, formatJson } from "../utils/output.js";
import { resolveClient } from "./helpers.js";

export function activityCommand(): Command {
  const cmd = new Command("activity").description("View recent and popular items").addHelpText(
    "after",
    `
Examples:
  $ metabase-cli activity recent
  $ metabase-cli activity popular`,
  );

  cmd
    .command("recent")
    .description("Show recently viewed items")
    .option("--format <format>", "Output format: table, json", "table")
    .addHelpText(
      "after",
      `
Examples:
  $ metabase-cli activity recent
  $ metabase-cli activity recent --format json`,
    )
    .action(async (opts) => {
      const client = await resolveClient();
      const api = new ActivityApi(client);
      const recents = await api.recentViews();

      if (opts.format === "json") {
        console.log(formatJson(recents));
        return;
      }

      console.log(
        formatEntityTable(recents as any[], [
          { key: "model", header: "Model" },
          { key: "id", header: "ID" },
          { key: "name", header: "Name" },
          { key: "timestamp", header: "Timestamp" },
        ]),
      );
    });

  cmd
    .command("popular")
    .description("Show popular items")
    .option("--format <format>", "Output format: table, json", "table")
    .addHelpText(
      "after",
      `
Examples:
  $ metabase-cli activity popular
  $ metabase-cli activity popular --format json`,
    )
    .action(async (opts) => {
      const client = await resolveClient();
      const api = new ActivityApi(client);
      const items = await api.popularItems();

      if (opts.format === "json") {
        console.log(formatJson(items));
        return;
      }

      console.log(
        formatEntityTable(items as any[], [
          { key: "model", header: "Model" },
          { key: "id", header: "ID" },
          { key: "name", header: "Name" },
        ]),
      );
    });

  return cmd;
}

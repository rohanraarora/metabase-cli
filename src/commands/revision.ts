import { Command } from "commander";
import { RevisionApi } from "../api/revision.js";
import { formatEntityTable, formatJson } from "../utils/output.js";
import { resolveClient } from "./helpers.js";

export function revisionCommand(): Command {
  const cmd = new Command("revision").description("Manage entity revisions").addHelpText(
    "after",
    `
Examples:
  $ metabase-cli revision list card 42
  $ metabase-cli revision list dashboard 7
  $ metabase-cli revision revert card 42 123`,
  );

  cmd
    .command("list <entity> <id>")
    .description("List revisions for an entity (card or dashboard)")
    .option("--format <format>", "Output format: table, json", "table")
    .addHelpText(
      "after",
      `
Examples:
  $ metabase-cli revision list card 42
  $ metabase-cli revision list dashboard 7
  $ metabase-cli revision list card 42 --format json`,
    )
    .action(async (entity: string, id: string, opts) => {
      if (entity !== "card" && entity !== "dashboard") {
        console.error(`Error: entity must be "card" or "dashboard", got "${entity}"`);
        process.exit(1);
      }

      const client = await resolveClient();
      const api = new RevisionApi(client);
      const revisions = await api.list(entity, parseInt(id));

      if (opts.format === "json") {
        console.log(formatJson(revisions));
        return;
      }

      const rows = (revisions as any[]).map((r) => ({
        id: r.id,
        timestamp: r.timestamp,
        user: r.user ? `${r.user.first_name} ${r.user.last_name}` : "",
        description: r.description ?? "",
        is_reversion: r.is_reversion ?? false,
        is_creation: r.is_creation ?? false,
      }));

      console.log(
        formatEntityTable(rows as any[], [
          { key: "id", header: "ID" },
          { key: "timestamp", header: "Timestamp" },
          { key: "user", header: "User" },
          { key: "description", header: "Description" },
          { key: "is_reversion", header: "Is Reversion" },
          { key: "is_creation", header: "Is Creation" },
        ]),
      );
    });

  cmd
    .command("revert <entity> <id> <revision-id>")
    .description("Revert an entity to a specific revision")
    .addHelpText(
      "after",
      `
Examples:
  $ metabase-cli revision revert card 42 123
  $ metabase-cli revision revert dashboard 7 456`,
    )
    .action(async (entity: string, id: string, revisionId: string) => {
      if (entity !== "card" && entity !== "dashboard") {
        console.error(`Error: entity must be "card" or "dashboard", got "${entity}"`);
        process.exit(1);
      }

      const client = await resolveClient();
      const api = new RevisionApi(client);
      await api.revert(entity, parseInt(id), parseInt(revisionId));
      console.log(`Reverted ${entity} #${id} to revision #${revisionId}.`);
    });

  return cmd;
}

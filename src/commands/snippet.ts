import { Command } from "commander";
import { SnippetApi } from "../api/snippet.js";
import { SafetyGuard } from "../safety/guard.js";
import { formatEntityTable, formatJson } from "../utils/output.js";
import { resolveClient, isUnsafe } from "./helpers.js";

export function snippetCommand(): Command {
  const cmd = new Command("snippet")
    .description("Manage SQL snippets")
    .addHelpText("after", `
Examples:
  $ metabase-cli snippet list
  $ metabase-cli snippet show 3
  $ metabase-cli snippet create --name "Active filter" --content "WHERE active = true"
  $ metabase-cli snippet update 3 --content "WHERE active AND NOT deleted" --unsafe`);

  cmd
    .command("list")
    .description("List snippets")
    .option("--archived", "Include archived snippets")
    .option("--format <format>", "Output format: table, json", "table")
    .addHelpText("after", `
Examples:
  $ metabase-cli snippet list
  $ metabase-cli snippet list --archived --format json`)
    .action(async (opts) => {
      const client = await resolveClient();
      const api = new SnippetApi(client);
      const params: Record<string, string> = {};
      if (opts.archived) params.archived = "true";

      const snippets = await api.list(params);

      if (opts.format === "json") {
        console.log(formatJson(snippets));
        return;
      }

      console.log(
        formatEntityTable(snippets as any[], [
          { key: "id", header: "ID" },
          { key: "name", header: "Name" },
          { key: "description", header: "Description" },
          { key: "creator_id", header: "Creator" },
        ]),
      );
    });

  cmd
    .command("show <id>")
    .description("Show snippet details and content")
    .addHelpText("after", `
Examples:
  $ metabase-cli snippet show 3`)
    .action(async (id: string) => {
      const client = await resolveClient();
      const api = new SnippetApi(client);
      const snippet = await api.get(parseInt(id));
      console.log(formatJson(snippet));
    });

  cmd
    .command("create")
    .description("Create a new snippet")
    .requiredOption("--name <name>", "Snippet name")
    .requiredOption("--content <sql>", "SQL content")
    .option("--description <desc>", "Description")
    .option("--collection <id>", "Collection ID", parseInt)
    .addHelpText("after", `
Examples:
  $ metabase-cli snippet create --name "Active filter" --content "WHERE active = true"
  $ metabase-cli snippet create --name "Date range" --content "WHERE created_at > NOW() - INTERVAL '30 days'"`)
    .action(async (opts) => {
      const client = await resolveClient();
      const api = new SnippetApi(client);
      const snippet = await api.create({
        name: opts.name,
        content: opts.content,
        description: opts.description,
        collection_id: opts.collection,
      });
      console.log(`Snippet #${snippet.id} "${snippet.name}" created.`);
    });

  cmd
    .command("update <id>")
    .description("Update a snippet (safe mode by default)")
    .option("--name <name>", "New name")
    .option("--content <sql>", "New SQL content")
    .option("--description <desc>", "New description")
    .option("--unsafe", "Bypass safe mode", false)
    .addHelpText("after", `
Safe mode blocks updates to snippets you didn't create. Use --unsafe to bypass.

Examples:
  $ metabase-cli snippet update 3 --content "WHERE active = true AND deleted_at IS NULL"
  $ metabase-cli snippet update 3 --name "New Name" --unsafe`)
    .action(async function (this: Command, id: string, opts) {
      const client = await resolveClient();
      const api = new SnippetApi(client);
      const guard = new SafetyGuard(client, isUnsafe(this, opts.unsafe));
      const snippetId = parseInt(id);

      await guard.guard("snippet", snippetId, "update", async () => {
        const updates: Record<string, unknown> = {};
        if (opts.name) updates.name = opts.name;
        if (opts.content) updates.content = opts.content;
        if (opts.description) updates.description = opts.description;
        const snippet = await api.update(snippetId, updates);
        console.log(`Snippet #${snippet.id} "${snippet.name}" updated.`);
      });
    });

  return cmd;
}

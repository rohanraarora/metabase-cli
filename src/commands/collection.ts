import { Command } from "commander";
import { CollectionApi } from "../api/collection.js";
import { SafetyGuard } from "../safety/guard.js";
import { formatEntityTable, formatJson } from "../utils/output.js";
import { resolveClient, isUnsafe } from "./helpers.js";

export function collectionCommand(): Command {
  const cmd = new Command("collection")
    .description("Manage collections")
    .addHelpText("after", `
Examples:
  $ metabase-cli collection list
  $ metabase-cli collection tree
  $ metabase-cli collection items 5 --models card
  $ metabase-cli collection create --name "Analytics" --parent 3`);

  cmd
    .command("list")
    .description("List all collections")
    .option("--format <format>", "Output format: table, json", "table")
    .addHelpText("after", `
Examples:
  $ metabase-cli collection list
  $ metabase-cli collection list --format json`)
    .action(async (opts) => {
      const client = await resolveClient();
      const api = new CollectionApi(client);
      const collections = await api.list();

      if (opts.format === "json") {
        console.log(formatJson(collections));
        return;
      }

      console.log(
        formatEntityTable(collections as any[], [
          { key: "id", header: "ID" },
          { key: "name", header: "Name" },
          { key: "parent_id", header: "Parent" },
        ]),
      );
    });

  cmd
    .command("tree")
    .description("Show collection hierarchy")
    .addHelpText("after", `
Examples:
  $ metabase-cli collection tree`)
    .action(async () => {
      const client = await resolveClient();
      const api = new CollectionApi(client);
      const tree = await api.tree();
      console.log(formatJson(tree));
    });

  cmd
    .command("show <id>")
    .description("Show collection details (use 'root' for root collection)")
    .addHelpText("after", `
Examples:
  $ metabase-cli collection show 5
  $ metabase-cli collection show root`)
    .action(async (id: string) => {
      const client = await resolveClient();
      const api = new CollectionApi(client);
      const coll = await api.get(id === "root" ? "root" : parseInt(id));
      console.log(formatJson(coll));
    });

  cmd
    .command("items <id>")
    .description("List items in a collection (use 'root' for root)")
    .option("--models <models>", "Filter by type: card, dashboard, collection")
    .option("--format <format>", "Output format: table, json", "table")
    .addHelpText("after", `
Examples:
  $ metabase-cli collection items 5
  $ metabase-cli collection items root --models card,dashboard
  $ metabase-cli collection items 5 --models card --format json`)
    .action(async (id: string, opts) => {
      const client = await resolveClient();
      const api = new CollectionApi(client);
      const params: Record<string, string> = {};
      if (opts.models) params.models = opts.models;

      const collId = id === "root" ? "root" : parseInt(id);
      const result = await api.items(collId, params);

      if (opts.format === "json") {
        console.log(formatJson(result));
        return;
      }

      console.log(
        formatEntityTable(result.data as any[], [
          { key: "id", header: "ID" },
          { key: "name", header: "Name" },
          { key: "model", header: "Type" },
          { key: "description", header: "Description" },
        ]),
      );
      console.log(`\n${result.total} item(s).`);
    });

  cmd
    .command("create")
    .description("Create a new collection")
    .requiredOption("--name <name>", "Collection name")
    .option("--description <desc>", "Description")
    .option("--parent <id>", "Parent collection ID", parseInt)
    .addHelpText("after", `
Examples:
  $ metabase-cli collection create --name "Analytics"
  $ metabase-cli collection create --name "Q1 Reports" --parent 3 --description "First quarter"`)
    .action(async (opts) => {
      const client = await resolveClient();
      const api = new CollectionApi(client);
      const coll = await api.create({
        name: opts.name,
        description: opts.description,
        parent_id: opts.parent,
      });
      console.log(`Collection #${coll.id} "${coll.name}" created.`);
    });

  cmd
    .command("update <id>")
    .description("Update a collection (safe mode by default)")
    .option("--name <name>", "New name")
    .option("--description <desc>", "New description")
    .option("--parent <id>", "Move to parent collection", parseInt)
    .option("--unsafe", "Bypass safe mode", false)
    .addHelpText("after", `
Safe mode blocks updates to collections you didn't create. Use --unsafe to bypass.

Examples:
  $ metabase-cli collection update 5 --name "New Name"
  $ metabase-cli collection update 5 --parent 3 --unsafe`)
    .action(async function (this: Command, id: string, opts) {
      const client = await resolveClient();
      const api = new CollectionApi(client);
      const guard = new SafetyGuard(client, isUnsafe(this, opts.unsafe));
      const collId = parseInt(id);

      await guard.guard("collection", collId, "update", async () => {
        const updates: Record<string, unknown> = {};
        if (opts.name) updates.name = opts.name;
        if (opts.description) updates.description = opts.description;
        if (opts.parent !== undefined) updates.parent_id = opts.parent;
        const coll = await api.update(collId, updates);
        console.log(`Collection #${coll.id} "${coll.name}" updated.`);
      });
    });

  return cmd;
}

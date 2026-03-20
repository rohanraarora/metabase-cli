import { Command } from "commander";
import { DashboardApi } from "../api/dashboard.js";
import { SafetyGuard } from "../safety/guard.js";
import { formatEntityTable, formatJson } from "../utils/output.js";
import { resolveClient, isUnsafe } from "./helpers.js";

export function dashboardCommand(): Command {
  const cmd = new Command("dashboard")
    .description("Manage dashboards")
    .addHelpText("after", `
Examples:
  $ metabase-cli dashboard list
  $ metabase-cli dashboard show 7
  $ metabase-cli dashboard create --name "Sales Overview" --collection 5
  $ metabase-cli dashboard update 7 --name "Updated" --unsafe
  $ metabase-cli dashboard delete 7
  $ metabase-cli dashboard copy 7 --name "Sales Overview (copy)"`);

  cmd
    .command("list")
    .description("List dashboards")
    .option("--format <format>", "Output format: table, json", "table")
    .addHelpText("after", `
Examples:
  $ metabase-cli dashboard list
  $ metabase-cli dashboard list --format json`)
    .action(async (opts) => {
      const client = await resolveClient();
      const api = new DashboardApi(client);
      const dashboards = await api.list();

      if (opts.format === "json") {
        console.log(formatJson(dashboards));
        return;
      }

      console.log(
        formatEntityTable(dashboards as any[], [
          { key: "id", header: "ID" },
          { key: "name", header: "Name" },
          { key: "collection_id", header: "Collection" },
          { key: "creator_id", header: "Creator" },
        ]),
      );
    });

  cmd
    .command("show <id>")
    .description("Show dashboard details")
    .addHelpText("after", `
Examples:
  $ metabase-cli dashboard show 7`)
    .action(async (id: string) => {
      const client = await resolveClient();
      const api = new DashboardApi(client);
      const dashboard = await api.get(parseInt(id));
      console.log(formatJson(dashboard));
    });

  cmd
    .command("create")
    .description("Create a new dashboard")
    .requiredOption("--name <name>", "Dashboard name")
    .option("--description <desc>", "Description")
    .option("--collection <id>", "Collection ID", parseInt)
    .addHelpText("after", `
Examples:
  $ metabase-cli dashboard create --name "Sales Overview"
  $ metabase-cli dashboard create --name "Q1 Report" --description "Quarterly report" --collection 5`)
    .action(async (opts) => {
      const client = await resolveClient();
      const api = new DashboardApi(client);
      const dashboard = await api.create({
        name: opts.name,
        description: opts.description,
        collection_id: opts.collection,
      });
      console.log(`Dashboard #${dashboard.id} "${dashboard.name}" created.`);
    });

  cmd
    .command("update <id>")
    .description("Update a dashboard (safe mode by default)")
    .option("--name <name>", "New name")
    .option("--description <desc>", "New description")
    .option("--collection <id>", "Move to collection", parseInt)
    .option("--unsafe", "Bypass safe mode", false)
    .addHelpText("after", `
Safe mode blocks updates to dashboards you didn't create. Use --unsafe to bypass.

Examples:
  $ metabase-cli dashboard update 7 --name "Updated Name"
  $ metabase-cli dashboard update 7 --collection 10 --unsafe`)
    .action(async function (this: Command, id: string, opts) {
      const client = await resolveClient();
      const api = new DashboardApi(client);
      const guard = new SafetyGuard(client, isUnsafe(this, opts.unsafe));
      const dashId = parseInt(id);

      await guard.guard("dashboard", dashId, "update", async () => {
        const updates: Record<string, unknown> = {};
        if (opts.name) updates.name = opts.name;
        if (opts.description) updates.description = opts.description;
        if (opts.collection !== undefined) updates.collection_id = opts.collection;
        const dashboard = await api.update(dashId, updates);
        console.log(`Dashboard #${dashboard.id} "${dashboard.name}" updated.`);
      });
    });

  cmd
    .command("delete <id>")
    .description("Delete a dashboard (safe mode by default)")
    .option("--unsafe", "Bypass safe mode", false)
    .addHelpText("after", `
Examples:
  $ metabase-cli dashboard delete 7
  $ metabase-cli dashboard delete 7 --unsafe`)
    .action(async function (this: Command, id: string, opts) {
      const client = await resolveClient();
      const api = new DashboardApi(client);
      const guard = new SafetyGuard(client, isUnsafe(this, opts.unsafe));
      const dashId = parseInt(id);

      await guard.guard("dashboard", dashId, "delete", async () => {
        await api.delete(dashId);
        console.log(`Dashboard #${dashId} deleted.`);
      });
    });

  cmd
    .command("copy <id>")
    .description("Copy a dashboard")
    .option("--name <name>", "Name for the copy")
    .option("--collection <id>", "Target collection", parseInt)
    .addHelpText("after", `
Examples:
  $ metabase-cli dashboard copy 7
  $ metabase-cli dashboard copy 7 --name "Sales Overview (copy)" --collection 10`)
    .action(async (id: string, opts) => {
      const client = await resolveClient();
      const api = new DashboardApi(client);
      const overrides: Record<string, unknown> = {};
      if (opts.name) overrides.name = opts.name;
      if (opts.collection !== undefined) overrides.collection_id = opts.collection;
      const dashboard = await api.copy(parseInt(id), overrides as any);
      console.log(`Dashboard #${dashboard.id} "${dashboard.name}" created (copy).`);
    });

  return cmd;
}

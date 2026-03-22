import { Command } from "commander";
import { DashboardApi } from "../api/dashboard.js";
import { SafetyGuard } from "../safety/guard.js";
import { formatEntityTable, formatJson } from "../utils/output.js";
import { resolveClient, isUnsafe } from "./helpers.js";

export function dashboardCommand(): Command {
  const cmd = new Command("dashboard").description("Manage dashboards").addHelpText(
    "after",
    `
Examples:
  $ metabase-cli dashboard list
  $ metabase-cli dashboard show 7
  $ metabase-cli dashboard create --name "Sales Overview" --collection 5
  $ metabase-cli dashboard update 7 --name "Updated" --unsafe
  $ metabase-cli dashboard delete 7
  $ metabase-cli dashboard copy 7 --name "Sales Overview (copy)"`,
  );

  cmd
    .command("list")
    .description("List dashboards")
    .option("--format <format>", "Output format: table, json", "table")
    .addHelpText(
      "after",
      `
Examples:
  $ metabase-cli dashboard list
  $ metabase-cli dashboard list --format json`,
    )
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
    .addHelpText(
      "after",
      `
Examples:
  $ metabase-cli dashboard show 7`,
    )
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
    .addHelpText(
      "after",
      `
Examples:
  $ metabase-cli dashboard create --name "Sales Overview"
  $ metabase-cli dashboard create --name "Q1 Report" --description "Quarterly report" --collection 5`,
    )
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
    .addHelpText(
      "after",
      `
Safe mode blocks updates to dashboards you didn't create. Use --unsafe to bypass.

Examples:
  $ metabase-cli dashboard update 7 --name "Updated Name"
  $ metabase-cli dashboard update 7 --collection 10 --unsafe`,
    )
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
    .addHelpText(
      "after",
      `
Examples:
  $ metabase-cli dashboard delete 7
  $ metabase-cli dashboard delete 7 --unsafe`,
    )
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
    .addHelpText(
      "after",
      `
Examples:
  $ metabase-cli dashboard copy 7
  $ metabase-cli dashboard copy 7 --name "Sales Overview (copy)" --collection 10`,
    )
    .action(async (id: string, opts) => {
      const client = await resolveClient();
      const api = new DashboardApi(client);
      const overrides: Record<string, unknown> = {};
      if (opts.name) overrides.name = opts.name;
      if (opts.collection !== undefined) overrides.collection_id = opts.collection;
      const dashboard = await api.copy(parseInt(id), overrides as any);
      console.log(`Dashboard #${dashboard.id} "${dashboard.name}" created (copy).`);
    });

  cmd
    .command("add-card <dashboard-id>")
    .description("Add a question card to a dashboard")
    .requiredOption("--card <id>", "Question/card ID to add", parseInt)
    .option("--row <n>", "Row position (default: auto)", parseInt)
    .option("--col <n>", "Column position (default: 0)", parseInt, 0)
    .option("--width <n>", "Card width (default: 6)", parseInt, 6)
    .option("--height <n>", "Card height (default: 4)", parseInt, 4)
    .addHelpText(
      "after",
      `
Examples:
  $ metabase-cli dashboard add-card 7 --card 42
  $ metabase-cli dashboard add-card 7 --card 42 --width 12 --height 8
  $ metabase-cli dashboard add-card 7 --card 42 --row 0 --col 6`,
    )
    .action(async (dashboardId: string, opts) => {
      const client = await resolveClient();
      const api = new DashboardApi(client);
      const dashId = parseInt(dashboardId);
      const dashboard = await api.get(dashId);

      // Auto-calculate row: place below existing cards
      let row = opts.row;
      if (row === undefined) {
        row = 0;
        for (const dc of dashboard.dashcards) {
          const bottom = dc.row + dc.size_y;
          if (bottom > row) row = bottom;
        }
      }

      const newCard = {
        id: -1,
        card_id: opts.card,
        row,
        col: opts.col,
        size_x: opts.width,
        size_y: opts.height,
      };

      const updatedCards = [
        ...dashboard.dashcards.map((dc: any) => ({
          id: dc.id,
          card_id: dc.card_id,
          row: dc.row,
          col: dc.col,
          size_x: dc.size_x,
          size_y: dc.size_y,
          parameter_mappings: dc.parameter_mappings,
          visualization_settings: dc.visualization_settings,
        })),
        newCard,
      ];

      await api.update(dashId, { dashcards: updatedCards });
      console.log(
        `Card #${opts.card} added to dashboard #${dashId} at row=${row}, col=${opts.col}.`,
      );
    });

  cmd
    .command("remove-card <dashboard-id>")
    .description("Remove a card from a dashboard")
    .requiredOption("--card <id>", "Question/card ID to remove", parseInt)
    .addHelpText(
      "after",
      `
Examples:
  $ metabase-cli dashboard remove-card 7 --card 42`,
    )
    .action(async (dashboardId: string, opts) => {
      const client = await resolveClient();
      const api = new DashboardApi(client);
      const dashId = parseInt(dashboardId);
      const dashboard = await api.get(dashId);

      const filtered = dashboard.dashcards.filter((dc: any) => dc.card_id !== opts.card);
      if (filtered.length === dashboard.dashcards.length) {
        console.error(`Card #${opts.card} not found on dashboard #${dashId}.`);
        process.exit(1);
      }

      const updatedCards = filtered.map((dc: any) => ({
        id: dc.id,
        card_id: dc.card_id,
        row: dc.row,
        col: dc.col,
        size_x: dc.size_x,
        size_y: dc.size_y,
        parameter_mappings: dc.parameter_mappings,
        visualization_settings: dc.visualization_settings,
      }));

      await api.update(dashId, { dashcards: updatedCards });
      console.log(`Card #${opts.card} removed from dashboard #${dashId}.`);
    });

  return cmd;
}

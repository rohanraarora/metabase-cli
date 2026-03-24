import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { Command } from "commander";
import { DashboardApi } from "../api/dashboard.js";
import { SafetyGuard } from "../safety/guard.js";
import { formatEntityTable, formatJson } from "../utils/output.js";
import { resolveClient, isUnsafe } from "./helpers.js";
import type { DashCard, Parameter, ParameterMapping } from "../types.js";

function generateParamId(): string {
  return randomBytes(4).toString("hex");
}

function serializeDashcard(dc: DashCard) {
  return {
    id: dc.id,
    card_id: dc.card_id,
    row: dc.row,
    col: dc.col,
    size_x: dc.size_x,
    size_y: dc.size_y,
    parameter_mappings: dc.parameter_mappings,
    visualization_settings: dc.visualization_settings,
  };
}

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

      const updatedCards = [...dashboard.dashcards.map(serializeDashcard), newCard];

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

      const filtered = dashboard.dashcards.filter((dc) => dc.card_id !== opts.card);
      if (filtered.length === dashboard.dashcards.length) {
        console.error(`Card #${opts.card} not found on dashboard #${dashId}.`);
        process.exit(1);
      }

      await api.update(dashId, { dashcards: filtered.map(serializeDashcard) });
      console.log(`Card #${opts.card} removed from dashboard #${dashId}.`);
    });

  // ─── Parameter/Filter Commands ──────────────────────────────────────────────

  cmd
    .command("list-params <dashboard-id>")
    .description("List filters/parameters on a dashboard")
    .option("--format <format>", "Output format: table, json", "table")
    .addHelpText(
      "after",
      `
Examples:
  $ metabase-cli dashboard list-params 7
  $ metabase-cli dashboard list-params 7 --format json`,
    )
    .action(async (dashboardId: string, opts) => {
      const client = await resolveClient();
      const api = new DashboardApi(client);
      const dashboard = await api.get(parseInt(dashboardId));

      if (opts.format === "json") {
        console.log(formatJson(dashboard.parameters));
        return;
      }

      if (dashboard.parameters.length === 0) {
        console.log("No parameters on this dashboard.");
        return;
      }

      console.log(
        formatEntityTable(dashboard.parameters as any[], [
          { key: "id", header: "ID" },
          { key: "name", header: "Name" },
          { key: "slug", header: "Slug" },
          { key: "type", header: "Type" },
          { key: "default", header: "Default" },
          { key: "values_source_type", header: "Source" },
        ]),
      );
    });

  cmd
    .command("add-param <dashboard-id>")
    .description("Add a filter/parameter to a dashboard")
    .requiredOption("--type <type>", "Parameter type (e.g. date/single, string/=, number/=)")
    .requiredOption("--name <name>", "Display name")
    .requiredOption("--slug <slug>", "URL slug")
    .option("--id <id>", "Parameter ID (auto-generated if omitted)")
    .option("--default <value>", "Default value")
    .option("--source-card <id>", "Values source card ID (for dropdown filters)", parseInt)
    .option("--source-value-field <json>", "Value field ref as JSON")
    .option("--source-label-field <json>", "Label field ref as JSON")
    .addHelpText(
      "after",
      `
Parameter types: date/single, date/range, string/=, string/contains, number/=, number/between, id

Examples:
  $ metabase-cli dashboard add-param 7 --type "date/single" --name "Start Date" --slug start_date --default "2026-01-01"
  $ metabase-cli dashboard add-param 7 --type "string/=" --name "Channel" --slug channel \\
      --source-card 99 --source-value-field '["field", "channel", {"base-type": "type/Text"}]'`,
    )
    .action(async (dashboardId: string, opts) => {
      const client = await resolveClient();
      const api = new DashboardApi(client);
      const dashId = parseInt(dashboardId);
      const dashboard = await api.get(dashId);

      const param: Parameter = {
        id: opts.id || generateParamId(),
        type: opts.type,
        name: opts.name,
        slug: opts.slug,
      };

      if (opts.default !== undefined) param.default = opts.default;

      if (opts.sourceCard) {
        param.values_source_type = "card";
        param.values_source_config = { card_id: opts.sourceCard };
        if (opts.sourceValueField) {
          param.values_source_config.value_field = JSON.parse(opts.sourceValueField);
        }
        if (opts.sourceLabelField) {
          param.values_source_config.label_field = JSON.parse(opts.sourceLabelField);
        }
      }

      await api.update(dashId, { parameters: [...dashboard.parameters, param] });
      console.log(`Parameter "${param.name}" (${param.id}) added to dashboard #${dashId}.`);
    });

  cmd
    .command("remove-param <dashboard-id>")
    .description("Remove a filter/parameter from a dashboard")
    .requiredOption("--param <id-or-slug>", "Parameter ID or slug to remove")
    .addHelpText(
      "after",
      `
Also removes all parameter mappings referencing this parameter from dashcards.

Examples:
  $ metabase-cli dashboard remove-param 7 --param start_date
  $ metabase-cli dashboard remove-param 7 --param f1a2b3c4`,
    )
    .action(async (dashboardId: string, opts) => {
      const client = await resolveClient();
      const api = new DashboardApi(client);
      const dashId = parseInt(dashboardId);
      const dashboard = await api.get(dashId);

      const paramMatch = dashboard.parameters.find(
        (p) => p.id === opts.param || p.slug === opts.param,
      );
      if (!paramMatch) {
        console.error(`Parameter "${opts.param}" not found on dashboard #${dashId}.`);
        process.exit(1);
      }

      const updatedParams = dashboard.parameters.filter((p) => p.id !== paramMatch.id);
      const updatedCards = dashboard.dashcards.map((dc) => ({
        ...serializeDashcard(dc),
        parameter_mappings: dc.parameter_mappings.filter((m) => m.parameter_id !== paramMatch.id),
      }));

      await api.update(dashId, { parameters: updatedParams, dashcards: updatedCards });
      console.log(`Parameter "${paramMatch.name}" removed from dashboard #${dashId}.`);
    });

  cmd
    .command("map-param <dashboard-id>")
    .description("Map a dashboard filter to a card's template tag")
    .requiredOption("--param <id>", "Parameter ID on the dashboard")
    .requiredOption("--card <id>", "Card/question ID on the dashboard", parseInt)
    .requiredOption(
      "--target <json>",
      'Mapping target as JSON (e.g. \'["variable", ["template-tag", "start_date"]]\')',
    )
    .addHelpText(
      "after",
      `
Examples:
  $ metabase-cli dashboard map-param 7 --param f1a2b3c4 --card 42 \\
      --target '["variable", ["template-tag", "start_date"]]'`,
    )
    .action(async (dashboardId: string, opts) => {
      const client = await resolveClient();
      const api = new DashboardApi(client);
      const dashId = parseInt(dashboardId);
      const dashboard = await api.get(dashId);

      const paramExists = dashboard.parameters.some((p) => p.id === opts.param);
      if (!paramExists) {
        console.error(`Parameter "${opts.param}" not found on dashboard #${dashId}.`);
        process.exit(1);
      }

      const dcIndex = dashboard.dashcards.findIndex((dc) => dc.card_id === opts.card);
      if (dcIndex === -1) {
        console.error(`Card #${opts.card} not found on dashboard #${dashId}.`);
        process.exit(1);
      }

      const mapping: ParameterMapping = {
        parameter_id: opts.param,
        card_id: opts.card,
        target: JSON.parse(opts.target),
      };

      const updatedCards = dashboard.dashcards.map((dc, i) => {
        const serialized = serializeDashcard(dc);
        if (i !== dcIndex) return serialized;

        // Replace existing mapping for same param+card, or append
        const filtered = dc.parameter_mappings.filter(
          (m) => !(m.parameter_id === opts.param && m.card_id === opts.card),
        );
        return { ...serialized, parameter_mappings: [...filtered, mapping] };
      });

      await api.update(dashId, { dashcards: updatedCards });
      console.log(
        `Parameter "${opts.param}" mapped to card #${opts.card} on dashboard #${dashId}.`,
      );
    });

  cmd
    .command("unmap-param <dashboard-id>")
    .description("Remove a parameter mapping from a card")
    .requiredOption("--param <id>", "Parameter ID")
    .requiredOption("--card <id>", "Card/question ID", parseInt)
    .addHelpText(
      "after",
      `
Examples:
  $ metabase-cli dashboard unmap-param 7 --param f1a2b3c4 --card 42`,
    )
    .action(async (dashboardId: string, opts) => {
      const client = await resolveClient();
      const api = new DashboardApi(client);
      const dashId = parseInt(dashboardId);
      const dashboard = await api.get(dashId);

      const updatedCards = dashboard.dashcards.map((dc) => {
        const serialized = serializeDashcard(dc);
        if (dc.card_id !== opts.card) return serialized;
        return {
          ...serialized,
          parameter_mappings: dc.parameter_mappings.filter((m) => m.parameter_id !== opts.param),
        };
      });

      await api.update(dashId, { dashcards: updatedCards });
      console.log(
        `Parameter "${opts.param}" unmapped from card #${opts.card} on dashboard #${dashId}.`,
      );
    });

  cmd
    .command("setup-filters <dashboard-id>")
    .description("Bulk setup filters and mappings from a JSON file")
    .requiredOption("--from-json <file>", "Path to JSON file with parameters and mappings")
    .addHelpText(
      "after",
      `
JSON file format:
{
  "parameters": [
    { "type": "date/single", "name": "Start Date", "slug": "start_date", "default": "2026-01-01" },
    { "type": "string/=", "name": "Channel", "slug": "channel",
      "values_source_type": "card",
      "values_source_config": { "card_id": 99, "value_field": ["field", "channel", {"base-type": "type/Text"}] }
    }
  ],
  "mappings": [
    { "param_slug": "start_date", "card_id": 42, "target": ["variable", ["template-tag", "start_date"]] }
  ]
}

Examples:
  $ metabase-cli dashboard setup-filters 7 --from-json filters.json`,
    )
    .action(async (dashboardId: string, opts) => {
      const client = await resolveClient();
      const api = new DashboardApi(client);
      const dashId = parseInt(dashboardId);
      const dashboard = await api.get(dashId);

      const config = JSON.parse(readFileSync(opts.fromJson, "utf-8"));

      // Build parameters with generated IDs
      const slugToId: Record<string, string> = {};
      const newParams: Parameter[] = (config.parameters || []).map((p: Record<string, unknown>) => {
        const id = (p.id as string) || generateParamId();
        slugToId[p.slug as string] = id;
        return { ...p, id };
      });

      const allParams = [...dashboard.parameters, ...newParams];

      // Validate and build mappings
      const cardIdsOnDash = new Set(dashboard.dashcards.map((dc) => dc.card_id));
      const allParamIds = new Set(allParams.map((p) => p.id));
      const mappingsByCard = new Map<number, ParameterMapping[]>();
      for (const m of config.mappings || []) {
        if (!cardIdsOnDash.has(m.card_id)) {
          console.error(`Card #${m.card_id} not found on dashboard #${dashId}.`);
          process.exit(1);
        }
        const paramId = slugToId[m.param_slug] || m.param_slug;
        if (!allParamIds.has(paramId)) {
          console.error(`Parameter "${m.param_slug}" not found in dashboard or JSON parameters.`);
          process.exit(1);
        }
        const mapping: ParameterMapping = {
          parameter_id: paramId,
          card_id: m.card_id,
          target: m.target,
        };
        const existing = mappingsByCard.get(m.card_id) || [];
        existing.push(mapping);
        mappingsByCard.set(m.card_id, existing);
      }

      const updatedCards = dashboard.dashcards.map((dc) => {
        const serialized = serializeDashcard(dc);
        const newMappings = mappingsByCard.get(dc.card_id!) || [];
        return {
          ...serialized,
          parameter_mappings: [...dc.parameter_mappings, ...newMappings],
        };
      });

      await api.update(dashId, { parameters: allParams, dashcards: updatedCards });
      console.log(
        `Setup ${newParams.length} parameter(s) and ${(config.mappings || []).length} mapping(s) on dashboard #${dashId}.`,
      );
    });

  return cmd;
}

import { Command } from "commander";
import { AlertApi } from "../api/alert.js";
import { formatEntityTable, formatJson } from "../utils/output.js";
import { resolveClient } from "./helpers.js";

export function alertCommand(): Command {
  const cmd = new Command("alert").description("Manage alerts").addHelpText(
    "after",
    `
Examples:
  $ metabase-cli alert list
  $ metabase-cli alert show 3
  $ metabase-cli alert create --card 42 --condition rows --first-only
  $ metabase-cli alert update 3 --condition goal --above-goal
  $ metabase-cli alert delete 3`,
  );

  cmd
    .command("list")
    .description("List all alerts")
    .option("--format <format>", "Output format: table, json", "table")
    .addHelpText(
      "after",
      `
Examples:
  $ metabase-cli alert list
  $ metabase-cli alert list --format json`,
    )
    .action(async (opts) => {
      const client = await resolveClient();
      const api = new AlertApi(client);
      const alerts = await api.list();

      if (opts.format === "json") {
        console.log(formatJson(alerts));
        return;
      }

      const rows = (alerts as any[]).map((a) => ({
        id: a.id,
        card_name: a.card?.name ?? a.name ?? "",
        alert_condition: a.alert_condition,
        alert_first_only: a.alert_first_only,
        creator: a.creator
          ? `${a.creator.first_name} ${a.creator.last_name}`
          : (a.creator_id ?? ""),
      }));
      console.log(
        formatEntityTable(rows, [
          { key: "id", header: "ID" },
          { key: "card_name", header: "Card" },
          { key: "alert_condition", header: "Condition" },
          { key: "alert_first_only", header: "First Only" },
          { key: "creator", header: "Creator" },
        ]),
      );
    });

  cmd
    .command("show <id>")
    .description("Show alert details")
    .addHelpText(
      "after",
      `
Examples:
  $ metabase-cli alert show 3`,
    )
    .action(async (id: string) => {
      const client = await resolveClient();
      const api = new AlertApi(client);
      const alert = await api.get(parseInt(id));
      console.log(formatJson(alert));
    });

  cmd
    .command("create")
    .description("Create a new alert")
    .requiredOption("--card <id>", "Card ID to alert on", parseInt)
    .option("--condition <condition>", "Alert condition: rows, goal", "rows")
    .option("--first-only", "Only alert the first time", false)
    .option("--above-goal", "Alert when above goal (for goal condition)", false)
    .option("--channel-type <type>", "Channel type: email, slack", "email")
    .option("--recipients <ids>", "Comma-separated recipient user IDs")
    .addHelpText(
      "after",
      `
Examples:
  $ metabase-cli alert create --card 42 --condition rows --first-only
  $ metabase-cli alert create --card 42 --condition goal --above-goal --channel-type email --recipients 1,2,3`,
    )
    .action(async (opts) => {
      const client = await resolveClient();
      const api = new AlertApi(client);

      const recipients = opts.recipients
        ? opts.recipients.split(",").map((id: string) => ({ id: parseInt(id.trim()) }))
        : [];

      const alert = await api.create({
        card: { id: opts.card },
        alert_condition: opts.condition as "rows" | "goal",
        alert_first_only: opts.firstOnly,
        alert_above_goal: opts.aboveGoal || undefined,
        channels: [
          {
            channel_type: opts.channelType,
            enabled: true,
            recipients,
          },
        ],
      });
      console.log(`Alert #${(alert as any).id} created.`);
    });

  cmd
    .command("update <id>")
    .description("Update an alert")
    .option("--card <id>", "Card ID", parseInt)
    .option("--condition <condition>", "Alert condition: rows, goal")
    .option("--first-only", "Only alert the first time")
    .option("--above-goal", "Alert when above goal")
    .option("--channel-type <type>", "Channel type: email, slack")
    .option("--recipients <ids>", "Comma-separated recipient user IDs")
    .addHelpText(
      "after",
      `
Examples:
  $ metabase-cli alert update 3 --condition goal --above-goal
  $ metabase-cli alert update 3 --recipients 1,2,3`,
    )
    .action(async (id: string, opts) => {
      const client = await resolveClient();
      const api = new AlertApi(client);
      const alertId = parseInt(id);

      const updates: Record<string, unknown> = {};
      if (opts.card !== undefined) updates.card = { id: opts.card };
      if (opts.condition) updates.alert_condition = opts.condition;
      if (opts.firstOnly !== undefined) updates.alert_first_only = opts.firstOnly;
      if (opts.aboveGoal !== undefined) updates.alert_above_goal = opts.aboveGoal;
      if (opts.channelType || opts.recipients) {
        const recipients = opts.recipients
          ? opts.recipients.split(",").map((rid: string) => ({ id: parseInt(rid.trim()) }))
          : [];
        updates.channels = [
          {
            channel_type: opts.channelType || "email",
            enabled: true,
            recipients,
          },
        ];
      }

      const alert = await api.update(alertId, updates);
      console.log(`Alert #${(alert as any).id} updated.`);
    });

  cmd
    .command("delete <id>")
    .description("Delete an alert")
    .addHelpText(
      "after",
      `
Examples:
  $ metabase-cli alert delete 3`,
    )
    .action(async (id: string) => {
      const client = await resolveClient();
      const api = new AlertApi(client);
      const alertId = parseInt(id);
      await api.delete(alertId);
      console.log(`Alert #${alertId} deleted.`);
    });

  return cmd;
}

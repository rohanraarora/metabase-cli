import { Command } from "commander";
import { AlertApi, type AlertChannel } from "../api/alert.js";
import { formatEntityTable, formatJson } from "../utils/output.js";
import { resolveClient } from "./helpers.js";

function buildChannel(opts: {
  channelType: string;
  recipients?: string;
  slackChannel?: string;
  schedule?: string;
  scheduleType?: string;
  scheduleHour?: string;
}): AlertChannel {
  const ch: AlertChannel = {
    channel_type: opts.channelType,
    enabled: true,
  };
  if (opts.recipients) {
    ch.recipients = opts.recipients
      .split(",")
      .map((id) => ({ id: parseInt(id.trim()) }))
      .filter((r) => !Number.isNaN(r.id));
  }
  if (opts.slackChannel) {
    ch.details = { channel: opts.slackChannel };
  }
  if (opts.schedule) {
    ch.cron_schedule = opts.schedule;
  } else if (opts.scheduleType) {
    ch.schedule_type = opts.scheduleType;
    if (opts.scheduleHour !== undefined) ch.schedule_hour = parseInt(opts.scheduleHour);
  }
  return ch;
}

export function alertCommand(): Command {
  const cmd = new Command("alert")
    .description(
      "Manage alerts. Alerts use the Notification API internally (changed in v0.6.0). For full notification control, use 'metabase-cli notification'.",
    )
    .addHelpText(
      "after",
      `
Examples:
  $ metabase-cli alert list
  $ metabase-cli alert show 3
  $ metabase-cli alert create --card 42 --condition rows --first-only
  $ metabase-cli alert create --card 42 --condition rows --channel-type slack --slack-channel "#alerts" --schedule "0 0 * * * ?"
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
        card_name: a.payload?.card?.name ?? a.payload?.card_id ?? "",
        alert_condition: a.payload?.send_condition ?? a.payload?.alert_condition ?? "",
        alert_first_only: a.payload?.send_once ?? a.payload?.alert_first_only ?? "",
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
    .option(
      "--channel-type <type>",
      "Channel type: email, slack (accepts bare or channel/-prefixed values)",
      "email",
    )
    .option("--recipients <ids>", "Comma-separated recipient user IDs (email handlers)")
    .option(
      "--slack-channel <name>",
      "Slack channel name (e.g. #alerts) -- required for Slack handlers",
    )
    .option(
      "--schedule <cron>",
      "Quartz/Spring cron schedule (e.g. '0 0 * * * ?' for hourly on the hour)",
    )
    .option(
      "--schedule-type <type>",
      "Legacy schedule cadence: hourly | daily | weekly | monthly",
    )
    .option("--schedule-hour <hour>", "Hour for daily/weekly schedules (0-23)")
    .addHelpText(
      "after",
      `
Examples:
  $ metabase-cli alert create --card 42 --condition rows --first-only
  $ metabase-cli alert create --card 42 --condition goal --above-goal --channel-type email --recipients 1,2,3
  $ metabase-cli alert create --card 42 --condition rows --channel-type slack --slack-channel "#alerts" --schedule "0 0 * * * ?"`,
    )
    .action(async (opts) => {
      const client = await resolveClient();
      const api = new AlertApi(client);

      if (opts.channelType === "slack" && !opts.slackChannel && !opts.recipients) {
        throw new Error(
          "Slack handler requires --slack-channel <#name> or --recipients <user_ids>.",
        );
      }

      const alert = await api.create({
        card: { id: opts.card },
        alert_condition: opts.condition as "rows" | "goal",
        alert_first_only: opts.firstOnly,
        alert_above_goal: opts.aboveGoal || undefined,
        channels: [
          buildChannel({
            channelType: opts.channelType,
            recipients: opts.recipients,
            slackChannel: opts.slackChannel,
            schedule: opts.schedule,
            scheduleType: opts.scheduleType,
            scheduleHour: opts.scheduleHour,
          }),
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
    .option("--slack-channel <name>", "Slack channel name (e.g. #alerts)")
    .option("--schedule <cron>", "Quartz/Spring cron schedule")
    .option("--schedule-type <type>", "Legacy cadence: hourly | daily | weekly | monthly")
    .option("--schedule-hour <hour>", "Hour for daily/weekly schedules (0-23)")
    .addHelpText(
      "after",
      `
Examples:
  $ metabase-cli alert update 3 --condition goal --above-goal
  $ metabase-cli alert update 3 --recipients 1,2,3
  $ metabase-cli alert update 3 --channel-type slack --slack-channel "#alerts" --schedule "0 0 * * * ?"`,
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
      const channelTouched =
        opts.channelType ||
        opts.recipients ||
        opts.slackChannel ||
        opts.schedule ||
        opts.scheduleType ||
        opts.scheduleHour !== undefined;
      if (channelTouched) {
        updates.channels = [
          buildChannel({
            channelType: opts.channelType || "email",
            recipients: opts.recipients,
            slackChannel: opts.slackChannel,
            schedule: opts.schedule,
            scheduleType: opts.scheduleType,
            scheduleHour: opts.scheduleHour,
          }),
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
      console.log(`Alert #${alertId} deleted (archived).`);
    });

  return cmd;
}

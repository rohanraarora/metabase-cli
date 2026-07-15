import { Command } from "commander";
import {
  canonicalizeChannelType,
  cronSubscription,
  NotificationApi,
  type NotificationHandler,
  type NotificationRecipient,
  type NotificationSendCondition,
  type NotificationSubscription,
  slackChannelRecipient,
  userRecipient,
} from "../api/notification.js";
import { formatEntityTable, formatJson } from "../utils/output.js";
import { resolveClient, parseIntArg } from "./helpers.js";

function parseSendCondition(raw: string): NotificationSendCondition {
  const v = raw.toLowerCase();
  if (v === "rows" || v === "has_result") return "has_result";
  if (v === "goal_above" || v === "above_goal") return "goal_above";
  if (v === "goal_below" || v === "below_goal") return "goal_below";
  throw new Error(
    `Invalid --condition "${raw}". Use one of: rows | has_result | goal_above | goal_below`,
  );
}

export function notificationCommand(): Command {
  const cmd = new Command("notification").description("Manage notifications").addHelpText(
    "after",
    `
Examples:
  $ metabase-cli notification list
  $ metabase-cli notification show 1
  $ metabase-cli notification create --card 42 --channel-type email --recipients "1,2,3"
  $ metabase-cli notification create --card 42 --channel-type slack --slack-channel "#alerts" --schedule "0 0 * * * ?"
  $ metabase-cli notification send 1`,
  );

  cmd
    .command("list")
    .description("List all notifications")
    .option("--format <format>", "Output format: table, json", "table")
    .addHelpText(
      "after",
      `
Examples:
  $ metabase-cli notification list
  $ metabase-cli notification list --format json`,
    )
    .action(async (opts) => {
      const client = await resolveClient();
      const api = new NotificationApi(client);
      const notifications = await api.list();

      if (opts.format === "json") {
        console.log(formatJson(notifications));
        return;
      }

      console.log(
        formatEntityTable(notifications as any[], [
          { key: "id", header: "ID" },
          { key: "payload_type", header: "Payload Type" },
          { key: "active", header: "Active" },
          { key: "creator_id", header: "Creator ID" },
        ]),
      );
    });

  cmd
    .command("show <id>")
    .description("Show notification details")
    .addHelpText(
      "after",
      `
Examples:
  $ metabase-cli notification show 1`,
    )
    .action(async (id: string) => {
      const client = await resolveClient();
      const api = new NotificationApi(client);
      const notification = await api.get(parseInt(id));
      console.log(formatJson(notification));
    });

  cmd
    .command("create")
    .description("Create a new notification")
    .requiredOption("--card <id>", "Card ID to notify on", parseIntArg)
    .option(
      "--channel-type <type>",
      "Channel type: email, slack (accepts bare or channel/-prefixed values)",
      "email",
    )
    .option("--recipients <ids>", "Comma-separated recipient user IDs (email handlers)")
    .option(
      "--slack-channel <name>",
      "Slack channel name (e.g. #alerts) -- emits a raw-value recipient. Required for Slack channels; user IDs alone are not enough.",
    )
    .option(
      "--schedule <cron>",
      "Quartz/Spring cron schedule (e.g. '0 0 * * * ?' for hourly on the hour). Mounted as a top-level subscription, NOT on the handler.",
    )
    .option(
      "--condition <type>",
      "Send condition: rows | has_result | goal_above | goal_below",
      "has_result",
    )
    .option("--send-once", "Send only the first time the condition is met", false)
    .option("--disable-links", "Disable links in the notification message", false)
    .addHelpText(
      "after",
      `
Examples:
  $ metabase-cli notification create --card 42 --channel-type email --recipients "1,2,3"
  $ metabase-cli notification create --card 42 --channel-type slack --slack-channel "#alerts" --schedule "0 0 * * * ?"
  $ metabase-cli notification create --card 42 --channel-type slack --slack-channel "#alerts" --condition goal_above --schedule "0 */15 * * * ?"`,
    )
    .action(async (opts) => {
      const client = await resolveClient();
      const api = new NotificationApi(client);

      const channelType = canonicalizeChannelType(opts.channelType);

      const recipients: NotificationRecipient[] = [];
      if (opts.recipients) {
        for (const id of opts.recipients.split(",")) {
          const parsed = parseInt(id.trim());
          if (!Number.isNaN(parsed)) recipients.push(userRecipient(parsed));
        }
      }
      if (opts.slackChannel) {
        recipients.push(slackChannelRecipient(opts.slackChannel));
      }

      if (channelType === "channel/slack" && recipients.length === 0) {
        throw new Error(
          "Slack handler requires either --slack-channel <#name> or --recipients <user_ids>.",
        );
      }

      const handler: NotificationHandler = { channel_type: channelType, recipients };

      const subscriptions: NotificationSubscription[] = opts.schedule
        ? [cronSubscription(opts.schedule)]
        : [];

      const notification = await api.create({
        payload_type: "notification/card",
        payload: {
          card_id: opts.card,
          send_condition: parseSendCondition(opts.condition),
          send_once: !!opts.sendOnce,
          disable_links: !!opts.disableLinks,
        },
        handlers: [handler],
        subscriptions,
        active: true,
      });
      console.log(`Notification #${(notification as any).id} created.`);
    });

  cmd
    .command("update <id>")
    .description("Update a notification")
    .option("--active <boolean>", "Set active status: true, false")
    .addHelpText(
      "after",
      `
Examples:
  $ metabase-cli notification update 1 --active false`,
    )
    .action(async (id: string, opts) => {
      const client = await resolveClient();
      const api = new NotificationApi(client);
      const notificationId = parseInt(id);

      const updates: Record<string, unknown> = {};
      if (opts.active !== undefined) {
        updates.active = opts.active === "true";
      }

      const notification = await api.update(notificationId, updates);
      console.log(`Notification #${(notification as any).id} updated.`);
    });

  cmd
    .command("send <id>")
    .description("Trigger immediate send of a notification")
    .addHelpText(
      "after",
      `
Examples:
  $ metabase-cli notification send 1`,
    )
    .action(async (id: string) => {
      const client = await resolveClient();
      const api = new NotificationApi(client);
      const notificationId = parseInt(id);
      await api.send(notificationId);
      console.log(`Notification #${notificationId} sent.`);
    });

  return cmd;
}

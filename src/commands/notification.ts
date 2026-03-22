import { Command } from "commander";
import { NotificationApi } from "../api/notification.js";
import { formatEntityTable, formatJson } from "../utils/output.js";
import { resolveClient } from "./helpers.js";

export function notificationCommand(): Command {
  const cmd = new Command("notification").description("Manage notifications").addHelpText(
    "after",
    `
Examples:
  $ metabase-cli notification list
  $ metabase-cli notification show 1
  $ metabase-cli notification create --card 42 --channel-type email --recipients "1,2,3"
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
    .requiredOption("--card <id>", "Card ID to notify on", parseInt)
    .option("--channel-type <type>", "Channel type: email, slack", "email")
    .option("--recipients <ids>", "Comma-separated recipient user IDs")
    .option("--schedule <cron>", "Cron expression for the schedule")
    .addHelpText(
      "after",
      `
Examples:
  $ metabase-cli notification create --card 42 --channel-type email --recipients "1,2,3"
  $ metabase-cli notification create --card 42 --channel-type slack --schedule "0 9 * * *"`,
    )
    .action(async (opts) => {
      const client = await resolveClient();
      const api = new NotificationApi(client);

      const recipientIds = opts.recipients
        ? opts.recipients.split(",").map((id: string) => parseInt(id.trim()))
        : [];

      const handler: Record<string, unknown> = {
        channel_type: opts.channelType,
        recipients: recipientIds.map((id: number) => ({
          type: "notification-recipient/user",
          user_id: id,
        })),
      };
      if (opts.schedule) {
        handler.schedule = opts.schedule;
      }

      const notification = await api.create({
        payload_type: "notification/card",
        payload: { card_id: opts.card },
        handlers: [handler as any],
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

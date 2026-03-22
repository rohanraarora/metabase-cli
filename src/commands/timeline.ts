import { Command } from "commander";
import { TimelineApi } from "../api/timeline.js";
import { formatEntityTable, formatJson } from "../utils/output.js";
import { resolveClient } from "./helpers.js";

export function timelineCommand(): Command {
  const cmd = new Command("timeline")
    .description("Manage timelines and timeline events")
    .addHelpText(
      "after",
      `
Examples:
  $ metabase-cli timeline list
  $ metabase-cli timeline show 1
  $ metabase-cli timeline create --name "Product launches"
  $ metabase-cli timeline add-event 1 --name "v2.0 release" --timestamp "2025-06-01T00:00:00Z"`,
    );

  cmd
    .command("list")
    .description("List all timelines")
    .option("--format <format>", "Output format: table, json", "table")
    .addHelpText(
      "after",
      `
Examples:
  $ metabase-cli timeline list
  $ metabase-cli timeline list --format json`,
    )
    .action(async (opts) => {
      const client = await resolveClient();
      const api = new TimelineApi(client);
      const timelines = await api.list();

      if (opts.format === "json") {
        console.log(formatJson(timelines));
        return;
      }

      console.log(
        formatEntityTable(timelines as any[], [
          { key: "id", header: "ID" },
          { key: "name", header: "Name" },
          { key: "icon", header: "Icon" },
          { key: "collection_id", header: "Collection ID" },
        ]),
      );
    });

  cmd
    .command("show <id>")
    .description("Show timeline details and events")
    .addHelpText(
      "after",
      `
Examples:
  $ metabase-cli timeline show 1
  $ metabase-cli timeline show 42`,
    )
    .action(async (id: string) => {
      const client = await resolveClient();
      const api = new TimelineApi(client);
      const timeline = await api.get(parseInt(id));
      console.log(formatJson(timeline));
    });

  cmd
    .command("create")
    .description("Create a new timeline")
    .requiredOption("--name <name>", "Timeline name")
    .option("--description <desc>", "Description")
    .option("--icon <icon>", "Icon", "star")
    .option("--collection <id>", "Collection ID", parseInt)
    .addHelpText(
      "after",
      `
Examples:
  $ metabase-cli timeline create --name "Product launches"
  $ metabase-cli timeline create --name "Releases" --icon "rocket" --collection 5
  $ metabase-cli timeline create --name "Milestones" --description "Key project milestones"`,
    )
    .action(async (opts) => {
      const client = await resolveClient();
      const api = new TimelineApi(client);
      const params: Record<string, unknown> = {
        name: opts.name,
        icon: opts.icon,
      };
      if (opts.description) params.description = opts.description;
      if (opts.collection !== undefined) params.collection_id = opts.collection;
      const timeline = await api.create(params as any);
      console.log(`Timeline #${(timeline as any).id} "${(timeline as any).name}" created.`);
    });

  cmd
    .command("update <id>")
    .description("Update a timeline")
    .option("--name <name>", "New name")
    .option("--description <desc>", "New description")
    .option("--icon <icon>", "New icon")
    .option("--collection <id>", "Collection ID", parseInt)
    .addHelpText(
      "after",
      `
Examples:
  $ metabase-cli timeline update 1 --name "Renamed timeline"
  $ metabase-cli timeline update 1 --icon "calendar" --description "Updated desc"`,
    )
    .action(async (id: string, opts) => {
      const client = await resolveClient();
      const api = new TimelineApi(client);
      const updates: Record<string, unknown> = {};
      if (opts.name) updates.name = opts.name;
      if (opts.description) updates.description = opts.description;
      if (opts.icon) updates.icon = opts.icon;
      if (opts.collection !== undefined) updates.collection_id = opts.collection;
      const timeline = await api.update(parseInt(id), updates as any);
      console.log(`Timeline #${(timeline as any).id} updated.`);
    });

  cmd
    .command("delete <id>")
    .description("Delete a timeline")
    .addHelpText(
      "after",
      `
Examples:
  $ metabase-cli timeline delete 1`,
    )
    .action(async (id: string) => {
      const client = await resolveClient();
      const api = new TimelineApi(client);
      await api.delete(parseInt(id));
      console.log(`Timeline #${id} deleted.`);
    });

  cmd
    .command("add-event <timeline-id>")
    .description("Add an event to a timeline")
    .requiredOption("--name <name>", "Event name")
    .requiredOption("--timestamp <timestamp>", "Event timestamp (ISO 8601 string)")
    .option("--description <desc>", "Event description")
    .option("--icon <icon>", "Event icon")
    .option("--time-matters", "Whether the time component matters", false)
    .addHelpText(
      "after",
      `
Examples:
  $ metabase-cli timeline add-event 1 --name "v2.0 release" --timestamp "2025-06-01T00:00:00Z"
  $ metabase-cli timeline add-event 1 --name "Launch" --timestamp "2025-03-15T14:30:00Z" --time-matters
  $ metabase-cli timeline add-event 3 --name "Outage" --timestamp "2025-01-10T08:00:00Z" --description "Service outage"`,
    )
    .action(async (timelineId: string, opts) => {
      const client = await resolveClient();
      const api = new TimelineApi(client);
      const params: Record<string, unknown> = {
        timeline_id: parseInt(timelineId),
        name: opts.name,
        timestamp: opts.timestamp,
      };
      if (opts.description) params.description = opts.description;
      if (opts.icon) params.icon = opts.icon;
      if (opts.timeMatters) params.time_matters = true;
      const event = await api.createEvent(params as any);
      console.log(
        `Event #${(event as any).id} "${(event as any).name}" added to timeline #${timelineId}.`,
      );
    });

  cmd
    .command("update-event <event-id>")
    .description("Update a timeline event")
    .option("--name <name>", "New event name")
    .option("--timestamp <timestamp>", "New timestamp (ISO 8601 string)")
    .option("--description <desc>", "New description")
    .option("--icon <icon>", "New icon")
    .option("--time-matters", "Whether the time component matters")
    .addHelpText(
      "after",
      `
Examples:
  $ metabase-cli timeline update-event 5 --name "Renamed event"
  $ metabase-cli timeline update-event 5 --timestamp "2025-07-01T00:00:00Z"`,
    )
    .action(async (eventId: string, opts) => {
      const client = await resolveClient();
      const api = new TimelineApi(client);
      const updates: Record<string, unknown> = {};
      if (opts.name) updates.name = opts.name;
      if (opts.timestamp) updates.timestamp = opts.timestamp;
      if (opts.description) updates.description = opts.description;
      if (opts.icon) updates.icon = opts.icon;
      if (opts.timeMatters !== undefined) updates.time_matters = opts.timeMatters;
      const event = await api.updateEvent(parseInt(eventId), updates as any);
      console.log(`Event #${(event as any).id} updated.`);
    });

  cmd
    .command("delete-event <event-id>")
    .description("Delete a timeline event")
    .addHelpText(
      "after",
      `
Examples:
  $ metabase-cli timeline delete-event 5`,
    )
    .action(async (eventId: string) => {
      const client = await resolveClient();
      const api = new TimelineApi(client);
      await api.deleteEvent(parseInt(eventId));
      console.log(`Event #${eventId} deleted.`);
    });

  return cmd;
}

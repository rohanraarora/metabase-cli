import { Command } from "commander";
import { SegmentApi } from "../api/segment.js";
import { formatEntityTable, formatJson } from "../utils/output.js";
import { resolveClient, resolveInput } from "./helpers.js";

export function segmentCommand(): Command {
  const cmd = new Command("segment").description("Manage segments").addHelpText(
    "after",
    `
Examples:
  $ metabase-cli segment list
  $ metabase-cli segment show 1
  $ metabase-cli segment create --name "Big Orders" --table 5 --definition '{"filter":[">",[" field",10],100]}'
  $ metabase-cli segment update 1 --name "Large Orders" --revision-message "Renamed"
  $ metabase-cli segment delete 1`,
  );

  cmd
    .command("list")
    .description("List all segments")
    .option("--format <format>", "Output format: table, json", "table")
    .addHelpText(
      "after",
      `
Examples:
  $ metabase-cli segment list
  $ metabase-cli segment list --format json`,
    )
    .action(async (opts) => {
      const client = await resolveClient();
      const api = new SegmentApi(client);
      const segments = await api.list();

      if (opts.format === "json") {
        console.log(formatJson(segments));
        return;
      }

      console.log(
        formatEntityTable(segments as any[], [
          { key: "id", header: "ID" },
          { key: "name", header: "Name" },
          { key: "table_id", header: "Table ID" },
          { key: "description", header: "Description" },
        ]),
      );
    });

  cmd
    .command("show <id>")
    .description("Show segment details")
    .addHelpText(
      "after",
      `
Examples:
  $ metabase-cli segment show 1`,
    )
    .action(async (id: string) => {
      const client = await resolveClient();
      const api = new SegmentApi(client);
      const segment = await api.get(parseInt(id));
      console.log(formatJson(segment));
    });

  cmd
    .command("create")
    .description("Create a new segment")
    .requiredOption("--name <name>", "Segment name")
    .requiredOption("--table <id>", "Table ID", parseInt)
    .option("--definition <json>", "Segment definition as JSON string")
    .option("--definition-file <path>", "Read segment definition from a JSON file")
    .option("--description <description>", "Segment description")
    .addHelpText(
      "after",
      `
Examples:
  $ metabase-cli segment create --name "Big Orders" --table 5 --definition '{"filter":[">",[" field",10],100]}'
  $ metabase-cli segment create --name "Big Orders" --table 5 --definition-file segment.json`,
    )
    .action(async (opts) => {
      const client = await resolveClient();
      const api = new SegmentApi(client);
      const defRaw = resolveInput(opts.definition, opts.definitionFile, "definition", "definition-file");
      const segment = await api.create({
        name: opts.name,
        table_id: opts.table,
        definition: JSON.parse(defRaw),
        description: opts.description,
      });
      console.log(`Segment #${(segment as any).id} created.`);
    });

  cmd
    .command("update <id>")
    .description("Update a segment")
    .option("--name <name>", "Segment name")
    .option("--definition <json>", "Segment definition as JSON string")
    .option("--definition-file <path>", "Read segment definition from a JSON file")
    .option("--description <description>", "Segment description")
    .option("--revision-message <message>", "Revision message")
    .addHelpText(
      "after",
      `
Examples:
  $ metabase-cli segment update 1 --name "Large Orders" --revision-message "Renamed"
  $ metabase-cli segment update 1 --definition-file updated-segment.json`,
    )
    .action(async (id: string, opts) => {
      const client = await resolveClient();
      const api = new SegmentApi(client);
      const segmentId = parseInt(id);

      const updates: Record<string, unknown> = {};
      if (opts.name !== undefined) updates.name = opts.name;
      if (opts.description !== undefined) updates.description = opts.description;
      if (opts.definition !== undefined || opts.definitionFile !== undefined) {
        const raw = resolveInput(opts.definition, opts.definitionFile, "definition", "definition-file");
        updates.definition = JSON.parse(raw);
      }
      if (opts.revisionMessage !== undefined) updates.revision_message = opts.revisionMessage;

      const segment = await api.update(segmentId, updates);
      console.log(`Segment #${(segment as any).id} updated.`);
    });

  cmd
    .command("delete <id>")
    .description("Delete a segment")
    .addHelpText(
      "after",
      `
Examples:
  $ metabase-cli segment delete 1`,
    )
    .action(async (id: string) => {
      const client = await resolveClient();
      const api = new SegmentApi(client);
      const segmentId = parseInt(id);
      await api.delete(segmentId);
      console.log(`Segment #${segmentId} deleted.`);
    });

  return cmd;
}

import { Command } from "commander";
import { DatabaseApi } from "../api/database.js";
import { TableApi } from "../api/table.js";
import { FieldApi } from "../api/field.js";
import { formatEntityTable, formatJson } from "../utils/output.js";
import { resolveClient } from "./helpers.js";

export function databaseCommand(): Command {
  const cmd = new Command("database")
    .description("Browse databases, tables, and fields")
    .addHelpText("after", `
Examples:
  $ metabase-cli database list
  $ metabase-cli database show 1
  $ metabase-cli database schemas 1
  $ metabase-cli database tables 1 public`);

  cmd
    .command("list")
    .description("List all databases")
    .option("--format <format>", "Output format: table, json", "table")
    .addHelpText("after", `
Examples:
  $ metabase-cli database list
  $ metabase-cli database list --format json`)
    .action(async (opts) => {
      const client = await resolveClient();
      const api = new DatabaseApi(client);
      const result = await api.list();

      if (opts.format === "json") {
        console.log(formatJson(result.data));
        return;
      }

      console.log(
        formatEntityTable(result.data as any[], [
          { key: "id", header: "ID" },
          { key: "name", header: "Name" },
          { key: "engine", header: "Engine" },
        ]),
      );
    });

  cmd
    .command("show <id>")
    .description("Show database details")
    .addHelpText("after", `
Examples:
  $ metabase-cli database show 1`)
    .action(async (id: string) => {
      const client = await resolveClient();
      const api = new DatabaseApi(client);
      const db = await api.get(parseInt(id));
      console.log(formatJson(db));
    });

  cmd
    .command("metadata <id>")
    .description("Show database metadata (tables and fields)")
    .addHelpText("after", `
Examples:
  $ metabase-cli database metadata 1`)
    .action(async (id: string) => {
      const client = await resolveClient();
      const api = new DatabaseApi(client);
      const meta = await api.metadata(parseInt(id));
      console.log(formatJson(meta));
    });

  cmd
    .command("schemas <id>")
    .description("List schemas in a database")
    .addHelpText("after", `
Examples:
  $ metabase-cli database schemas 1`)
    .action(async (id: string) => {
      const client = await resolveClient();
      const api = new DatabaseApi(client);
      const schemas = await api.schemas(parseInt(id));
      for (const s of schemas) console.log(s);
    });

  cmd
    .command("tables <dbId> <schema>")
    .description("List tables in a database schema")
    .option("--format <format>", "Output format: table, json", "table")
    .addHelpText("after", `
Examples:
  $ metabase-cli database tables 1 public
  $ metabase-cli database tables 1 public --format json`)
    .action(async (dbId: string, schema: string, opts) => {
      const client = await resolveClient();
      const api = new DatabaseApi(client);
      const tables = await api.tablesInSchema(parseInt(dbId), schema);

      if (opts.format === "json") {
        console.log(formatJson(tables));
        return;
      }

      console.log(
        formatEntityTable(tables as any[], [
          { key: "id", header: "ID" },
          { key: "name", header: "Name" },
          { key: "display_name", header: "Display Name" },
        ]),
      );
    });

  return cmd;
}

export function tableCommand(): Command {
  const cmd = new Command("table")
    .description("Inspect tables")
    .addHelpText("after", `
Examples:
  $ metabase-cli table show 15
  $ metabase-cli table metadata 15
  $ metabase-cli table fks 15`);

  cmd
    .command("show <id>")
    .description("Show table details")
    .addHelpText("after", `
Examples:
  $ metabase-cli table show 15`)
    .action(async (id: string) => {
      const client = await resolveClient();
      const api = new TableApi(client);
      const table = await api.get(parseInt(id));
      console.log(formatJson(table));
    });

  cmd
    .command("metadata <id>")
    .description("Show table metadata with fields")
    .option("--format <format>", "Output format: table, json", "table")
    .addHelpText("after", `
Examples:
  $ metabase-cli table metadata 15
  $ metabase-cli table metadata 15 --format json`)
    .action(async (id: string, opts) => {
      const client = await resolveClient();
      const api = new TableApi(client);
      const meta = await api.queryMetadata(parseInt(id));

      if (opts.format === "json") {
        console.log(formatJson(meta));
        return;
      }

      console.log(`Table: ${meta.name} (${meta.display_name})`);
      console.log(
        formatEntityTable(meta.fields as any[], [
          { key: "id", header: "ID" },
          { key: "name", header: "Name" },
          { key: "display_name", header: "Display Name" },
          { key: "base_type", header: "Type" },
          { key: "semantic_type", header: "Semantic" },
        ]),
      );
    });

  cmd
    .command("fks <id>")
    .description("Show foreign keys for a table")
    .addHelpText("after", `
Examples:
  $ metabase-cli table fks 15`)
    .action(async (id: string) => {
      const client = await resolveClient();
      const api = new TableApi(client);
      const fks = await api.foreignKeys(parseInt(id));
      console.log(formatJson(fks));
    });

  return cmd;
}

export function fieldCommand(): Command {
  const cmd = new Command("field")
    .description("Inspect fields")
    .addHelpText("after", `
Examples:
  $ metabase-cli field show 100
  $ metabase-cli field values 100`);

  cmd
    .command("show <id>")
    .description("Show field details")
    .addHelpText("after", `
Examples:
  $ metabase-cli field show 100`)
    .action(async (id: string) => {
      const client = await resolveClient();
      const api = new FieldApi(client);
      const field = await api.get(parseInt(id));
      console.log(formatJson(field));
    });

  cmd
    .command("values <id>")
    .description("Show distinct values for a field")
    .addHelpText("after", `
Examples:
  $ metabase-cli field values 100`)
    .action(async (id: string) => {
      const client = await resolveClient();
      const api = new FieldApi(client);
      const result = await api.values(parseInt(id));
      console.log(formatJson(result));
    });

  return cmd;
}

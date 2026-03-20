import Table from "cli-table3";
import type { DatasetResponse, OutputFormat } from "../types.js";

export function formatDatasetResponse(
  dataset: DatasetResponse,
  format: OutputFormat = "table",
  columns?: string[],
): string {
  const cols = dataset.data.cols;
  const rows = dataset.data.rows;

  // Filter columns if specified
  let colIndices: number[];
  if (columns?.length) {
    colIndices = columns.map((name) => {
      const idx = cols.findIndex(
        (c) => c.name === name || c.display_name === name,
      );
      if (idx === -1) throw new Error(`Column "${name}" not found`);
      return idx;
    });
  } else {
    colIndices = cols.map((_, i) => i);
  }

  const filteredCols = colIndices.map((i) => cols[i]);
  const filteredRows = rows.map((row) => colIndices.map((i) => row[i]));

  switch (format) {
    case "json":
      return JSON.stringify(
        filteredRows.map((row) =>
          Object.fromEntries(
            filteredCols.map((col, i) => [col.name, row[i]]),
          ),
        ),
        null,
        2,
      );

    case "csv":
      return formatDelimited(filteredCols, filteredRows, ",");

    case "tsv":
      return formatDelimited(filteredCols, filteredRows, "\t");

    case "table":
    default:
      return formatTable(filteredCols, filteredRows);
  }
}

function formatDelimited(
  cols: { name: string }[],
  rows: unknown[][],
  delimiter: string,
): string {
  const header = cols.map((c) => escapeCsvField(String(c.name), delimiter)).join(delimiter);
  const body = rows.map((row) =>
    row.map((cell) => escapeCsvField(formatCell(cell), delimiter)).join(delimiter),
  );
  return [header, ...body].join("\n");
}

function escapeCsvField(value: string, delimiter: string): string {
  if (value.includes(delimiter) || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatTable(cols: { display_name: string }[], rows: unknown[][]): string {
  const table = new Table({
    head: cols.map((c) => c.display_name),
    style: { head: ["cyan"] },
  });

  for (const row of rows) {
    table.push(row.map((cell) => formatCell(cell)));
  }

  return table.toString();
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function formatJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

export function formatEntityTable(
  items: Record<string, unknown>[],
  columns: { key: string; header: string }[],
): string {
  const table = new Table({
    head: columns.map((c) => c.header),
    style: { head: ["cyan"] },
  });

  for (const item of items) {
    table.push(columns.map((c) => formatCell(item[c.key])));
  }

  return table.toString();
}

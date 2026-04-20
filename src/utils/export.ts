import { formatInBandError } from "./errors.js";

/**
 * Checks if an export response body is actually a JSON error from Metabase.
 * Metabase streaming export endpoints may return 200 with a JSON error body
 * instead of the expected format (CSV/XLSX).
 */
export function checkExportError(buf: Buffer, format: string): void {
  // For non-JSON formats, if the response starts with '{' it's likely a JSON error body
  if (format !== "json" && buf.length > 0 && buf[0] === 0x7b) {
    try {
      const parsed = JSON.parse(buf.toString("utf-8"));
      if (parsed.status === "failed" || parsed.error) {
        throw new Error(`Query failed: ${formatInBandError(parsed.error)}`);
      }
    } catch (e: any) {
      if (e.message.startsWith("Query failed:")) throw e;
    }
  }
}

/** Map file extensions to export format identifiers */
export const EXT_TO_FORMAT: Record<string, string> = {
  ".csv": "csv",
  ".tsv": "tsv",
  ".json": "json",
  ".xlsx": "xlsx",
};

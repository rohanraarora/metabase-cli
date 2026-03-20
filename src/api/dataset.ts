import type { MetabaseClient } from "../client.js";
import type { DatasetQuery, DatasetResponse } from "../types.js";
import { checkExportError } from "../utils/export.js";

export class DatasetApi {
  constructor(private client: MetabaseClient) {}

  async query(datasetQuery: DatasetQuery): Promise<DatasetResponse> {
    return this.client.post<DatasetResponse>("/api/dataset", datasetQuery);
  }

  async queryNative(
    database: number,
    sql: string,
    templateTags?: Record<string, unknown>,
  ): Promise<DatasetResponse> {
    return this.query({
      type: "native",
      database,
      native: {
        query: sql,
        "template-tags": templateTags ?? {},
      },
    });
  }

  async export(
    datasetQuery: DatasetQuery,
    format: "csv" | "json" | "xlsx",
  ): Promise<string> {
    const res = await this.client.requestRaw(
      "POST",
      `/api/dataset/${format}`,
      datasetQuery,
    );
    if (!res.ok) {
      throw new Error(`Export failed: ${res.status} ${await res.text()}`);
    }
    return res.text();
  }

  async exportBinary(
    datasetQuery: DatasetQuery,
    format: "csv" | "json" | "xlsx",
  ): Promise<Buffer> {
    const res = await this.client.requestFormExport(
      `/api/dataset/${format}`,
      { query: JSON.stringify(datasetQuery) },
    );
    if (!res.ok) {
      throw new Error(`Export failed: ${res.status} ${await res.text()}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    checkExportError(buf, format);
    return buf;
  }
}

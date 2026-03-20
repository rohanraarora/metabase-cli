import type { MetabaseClient } from "../client.js";
import type { Table, Field } from "../types.js";

export class TableApi {
  constructor(private client: MetabaseClient) {}

  async get(id: number): Promise<Table> {
    return this.client.get<Table>(`/api/table/${id}`);
  }

  async queryMetadata(id: number): Promise<Table & { fields: Field[] }> {
    return this.client.get(`/api/table/${id}/query_metadata`);
  }

  async foreignKeys(id: number): Promise<unknown[]> {
    return this.client.get(`/api/table/${id}/fks`);
  }
}

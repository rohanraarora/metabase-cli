import type { MetabaseClient } from "../client.js";
import type { Database, Table } from "../types.js";

export class DatabaseApi {
  constructor(private client: MetabaseClient) {}

  async list(): Promise<{ data: Database[] }> {
    return this.client.get("/api/database");
  }

  async get(id: number): Promise<Database> {
    return this.client.get<Database>(`/api/database/${id}`);
  }

  async metadata(id: number): Promise<Database & { tables: Table[] }> {
    return this.client.get(`/api/database/${id}/metadata`);
  }

  async schemas(id: number): Promise<string[]> {
    return this.client.get<string[]>(`/api/database/${id}/schemas`);
  }

  async tablesInSchema(id: number, schema: string): Promise<Table[]> {
    return this.client.get<Table[]>(`/api/database/${id}/schema/${encodeURIComponent(schema)}`);
  }
}

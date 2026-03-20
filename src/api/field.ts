import type { MetabaseClient } from "../client.js";
import type { Field } from "../types.js";

export class FieldApi {
  constructor(private client: MetabaseClient) {}

  async get(id: number): Promise<Field> {
    return this.client.get<Field>(`/api/field/${id}`);
  }

  async values(id: number): Promise<{ values: unknown[][] }> {
    return this.client.get(`/api/field/${id}/values`);
  }
}

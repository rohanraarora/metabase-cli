import type { MetabaseClient } from "../client.js";

export interface CreateSegmentParams {
  name: string;
  description?: string;
  table_id: number;
  definition: { filter: unknown[] };
}

export interface UpdateSegmentParams {
  name?: string;
  description?: string;
  definition?: { filter: unknown[] };
  revision_message?: string;
}

export class SegmentApi {
  constructor(private client: MetabaseClient) {}

  async list(): Promise<unknown[]> {
    return this.client.get<unknown[]>("/api/segment");
  }

  async get(id: number): Promise<unknown> {
    return this.client.get<unknown>(`/api/segment/${id}`);
  }

  async create(params: CreateSegmentParams): Promise<unknown> {
    return this.client.post<unknown>("/api/segment", params);
  }

  async update(id: number, params: UpdateSegmentParams): Promise<unknown> {
    return this.client.put<unknown>(`/api/segment/${id}`, params);
  }

  async delete(id: number): Promise<void> {
    await this.client.delete(`/api/segment/${id}?revision_message=Deleted+via+CLI`);
  }
}

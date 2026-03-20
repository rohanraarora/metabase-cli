import type { MetabaseClient } from "../client.js";
import type { Card, DatasetResponse, DatasetQuery } from "../types.js";

export interface CreateCardParams {
  name: string;
  dataset_query: DatasetQuery;
  display: string;
  description?: string;
  collection_id?: number;
  visualization_settings?: Record<string, unknown>;
}

export interface UpdateCardParams {
  name?: string;
  description?: string;
  collection_id?: number;
  dataset_query?: DatasetQuery;
  display?: string;
  visualization_settings?: Record<string, unknown>;
  archived?: boolean;
}

export class CardApi {
  constructor(private client: MetabaseClient) {}

  async list(params?: Record<string, string>): Promise<Card[]> {
    return this.client.get<Card[]>("/api/card", params);
  }

  async get(id: number): Promise<Card> {
    return this.client.get<Card>(`/api/card/${id}`);
  }

  async create(params: CreateCardParams): Promise<Card> {
    return this.client.post<Card>("/api/card", params);
  }

  async update(id: number, params: UpdateCardParams): Promise<Card> {
    return this.client.put<Card>(`/api/card/${id}`, params);
  }

  async delete(id: number): Promise<void> {
    await this.client.delete(`/api/card/${id}`);
  }

  async copy(id: number, overrides?: Partial<CreateCardParams>): Promise<Card> {
    return this.client.post<Card>(`/api/card/${id}/copy`, overrides);
  }

  async query(id: number, parameters?: unknown[]): Promise<DatasetResponse> {
    return this.client.post<DatasetResponse>(`/api/card/${id}/query`, {
      parameters: parameters ?? [],
    });
  }

  async queryExport(
    id: number,
    format: "csv" | "json" | "xlsx",
    parameters?: unknown[],
  ): Promise<string> {
    const res = await this.client.requestRaw(
      "POST",
      `/api/card/${id}/query/${format}`,
      { parameters: parameters ?? [] },
    );
    if (!res.ok) {
      throw new Error(`Export failed: ${res.status} ${await res.text()}`);
    }
    return res.text();
  }
}

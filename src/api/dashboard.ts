import type { MetabaseClient } from "../client.js";
import type { Dashboard } from "../types.js";

export interface CreateDashboardParams {
  name: string;
  description?: string;
  collection_id?: number;
  parameters?: unknown[];
}

export interface UpdateDashboardParams {
  name?: string;
  description?: string;
  collection_id?: number;
  parameters?: unknown[];
  dashcards?: unknown[];
  archived?: boolean;
}

export class DashboardApi {
  constructor(private client: MetabaseClient) {}

  async list(params?: Record<string, string>): Promise<Dashboard[]> {
    return this.client.get<Dashboard[]>("/api/dashboard", params);
  }

  async get(id: number): Promise<Dashboard> {
    return this.client.get<Dashboard>(`/api/dashboard/${id}`);
  }

  async create(params: CreateDashboardParams): Promise<Dashboard> {
    return this.client.post<Dashboard>("/api/dashboard", params);
  }

  async update(id: number, params: UpdateDashboardParams): Promise<Dashboard> {
    return this.client.put<Dashboard>(`/api/dashboard/${id}`, params);
  }

  async delete(id: number): Promise<void> {
    await this.client.delete(`/api/dashboard/${id}`);
  }

  async copy(id: number, overrides?: Partial<CreateDashboardParams>): Promise<Dashboard> {
    return this.client.post<Dashboard>(`/api/dashboard/${id}/copy`, overrides);
  }
}

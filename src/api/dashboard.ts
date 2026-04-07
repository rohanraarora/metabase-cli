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
    // Try the dedicated dashboard endpoint first (deprecated in newer Metabase)
    try {
      const res = await this.client.requestRaw("GET", "/api/dashboard");
      if (res.status === 404) {
        return this.listViaSearch();
      }
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`${res.status} ${res.statusText}: ${err}`);
      }
      return (await res.json()) as Dashboard[];
    } catch (e: unknown) {
      // If the error is from our 404 handling, rethrow
      if (e instanceof Error && e.message.includes("404")) {
        return this.listViaSearch();
      }
      throw e;
    }
  }

  private async listViaSearch(): Promise<Dashboard[]> {
    const res = await this.client.get<{ data: Dashboard[] }>("/api/search", {
      models: "dashboard",
      limit: "2000",
    });
    return res.data;
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

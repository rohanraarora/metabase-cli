import type { MetabaseClient } from "../client.js";

export interface AlertChannel {
  channel_type: string;
  enabled: boolean;
  recipients?: { id: number }[];
  details?: Record<string, unknown>;
  schedule_type?: string;
  schedule_hour?: number;
  schedule_day?: string;
}

export interface CreateAlertParams {
  card: { id: number };
  alert_condition: "rows" | "goal";
  alert_first_only: boolean;
  alert_above_goal?: boolean;
  channels: AlertChannel[];
}

export interface UpdateAlertParams {
  card?: { id: number };
  alert_condition?: "rows" | "goal";
  alert_first_only?: boolean;
  alert_above_goal?: boolean;
  channels?: AlertChannel[];
}

export class AlertApi {
  constructor(private client: MetabaseClient) {}

  async list(): Promise<unknown[]> {
    return this.client.get<unknown[]>("/api/alert");
  }

  async get(id: number): Promise<unknown> {
    return this.client.get<unknown>(`/api/alert/${id}`);
  }

  async create(params: CreateAlertParams): Promise<unknown> {
    return this.client.post<unknown>("/api/alert", params);
  }

  async update(id: number, params: UpdateAlertParams): Promise<unknown> {
    return this.client.put<unknown>(`/api/alert/${id}`, params);
  }

  async delete(id: number): Promise<void> {
    await this.client.delete(`/api/alert/${id}`);
  }
}

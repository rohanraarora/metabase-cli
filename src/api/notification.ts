import type { MetabaseClient } from "../client.js";

export interface CreateNotificationParams {
  payload_type: string;
  payload: { card_id: number };
  handlers: {
    channel_type: string;
    channel_id?: number;
    recipients?: { type: string; user_id: number }[];
    schedule?: string;
  }[];
  active: boolean;
}

export interface UpdateNotificationParams {
  payload_type?: string;
  payload?: { card_id: number };
  handlers?: {
    channel_type: string;
    channel_id?: number;
    recipients?: { type: string; user_id: number }[];
    schedule?: string;
  }[];
  active?: boolean;
}

export class NotificationApi {
  constructor(private client: MetabaseClient) {}

  async list(): Promise<unknown[]> {
    return this.client.get<unknown[]>("/api/notification");
  }

  async get(id: number): Promise<unknown> {
    return this.client.get<unknown>(`/api/notification/${id}`);
  }

  async create(params: CreateNotificationParams): Promise<unknown> {
    return this.client.post<unknown>("/api/notification", params);
  }

  async update(id: number, params: UpdateNotificationParams): Promise<unknown> {
    return this.client.put<unknown>(`/api/notification/${id}`, params);
  }

  async send(id: number): Promise<void> {
    await this.client.post<unknown>(`/api/notification/${id}/send`, {});
  }
}

import type { MetabaseClient } from "../client.js";

export interface CreateTimelineParams {
  name: string;
  description?: string;
  icon?: string;
  collection_id?: number;
  archived?: boolean;
}

export interface UpdateTimelineParams {
  name?: string;
  description?: string;
  icon?: string;
  collection_id?: number;
  archived?: boolean;
}

export interface CreateTimelineEventParams {
  timeline_id: number;
  name: string;
  timestamp: string;
  description?: string;
  icon?: string;
  time_matters?: boolean;
  archived?: boolean;
}

export interface UpdateTimelineEventParams {
  timeline_id?: number;
  name?: string;
  timestamp?: string;
  description?: string;
  icon?: string;
  time_matters?: boolean;
  archived?: boolean;
}

export class TimelineApi {
  constructor(private client: MetabaseClient) {}

  async list(): Promise<unknown[]> {
    return this.client.get<unknown[]>("/api/timeline");
  }

  async get(id: number): Promise<unknown> {
    return this.client.get<unknown>(`/api/timeline/${id}`);
  }

  async create(params: CreateTimelineParams): Promise<unknown> {
    return this.client.post<unknown>("/api/timeline", params);
  }

  async update(id: number, params: UpdateTimelineParams): Promise<unknown> {
    return this.client.put<unknown>(`/api/timeline/${id}`, params);
  }

  async delete(id: number): Promise<void> {
    await this.client.delete(`/api/timeline/${id}`);
  }

  async createEvent(params: CreateTimelineEventParams): Promise<unknown> {
    return this.client.post<unknown>("/api/timeline-event", params);
  }

  async updateEvent(id: number, params: UpdateTimelineEventParams): Promise<unknown> {
    return this.client.put<unknown>(`/api/timeline-event/${id}`, params);
  }

  async deleteEvent(id: number): Promise<void> {
    await this.client.delete(`/api/timeline-event/${id}`);
  }
}

import type { MetabaseClient } from "../client.js";
import type { Collection } from "../types.js";

export interface CreateCollectionParams {
  name: string;
  description?: string;
  parent_id?: number;
}

export interface UpdateCollectionParams {
  name?: string;
  description?: string;
  parent_id?: number;
  archived?: boolean;
}

export interface CollectionItem {
  id: number;
  name: string;
  model: string;
  description: string | null;
  [key: string]: unknown;
}

export class CollectionApi {
  constructor(private client: MetabaseClient) {}

  async list(): Promise<Collection[]> {
    return this.client.get<Collection[]>("/api/collection");
  }

  async tree(): Promise<Collection[]> {
    return this.client.get<Collection[]>("/api/collection/tree");
  }

  async get(id: number | "root"): Promise<Collection> {
    return this.client.get<Collection>(`/api/collection/${id}`);
  }

  async items(
    id: number | "root",
    params?: Record<string, string>,
  ): Promise<{ data: CollectionItem[]; total: number }> {
    return this.client.get(`/api/collection/${id}/items`, params);
  }

  async create(params: CreateCollectionParams): Promise<Collection> {
    return this.client.post<Collection>("/api/collection", params);
  }

  async update(id: number, params: UpdateCollectionParams): Promise<Collection> {
    return this.client.put<Collection>(`/api/collection/${id}`, params);
  }
}

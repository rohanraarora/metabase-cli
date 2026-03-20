import type { MetabaseClient } from "../client.js";
import type { Snippet } from "../types.js";

export interface CreateSnippetParams {
  name: string;
  content: string;
  description?: string;
  collection_id?: number;
}

export interface UpdateSnippetParams {
  name?: string;
  content?: string;
  description?: string;
  collection_id?: number;
  archived?: boolean;
}

export class SnippetApi {
  constructor(private client: MetabaseClient) {}

  async list(params?: Record<string, string>): Promise<Snippet[]> {
    return this.client.get<Snippet[]>("/api/native-query-snippet", params);
  }

  async get(id: number): Promise<Snippet> {
    return this.client.get<Snippet>(`/api/native-query-snippet/${id}`);
  }

  async create(params: CreateSnippetParams): Promise<Snippet> {
    return this.client.post<Snippet>("/api/native-query-snippet", params);
  }

  async update(id: number, params: UpdateSnippetParams): Promise<Snippet> {
    return this.client.put<Snippet>(`/api/native-query-snippet/${id}`, params);
  }
}

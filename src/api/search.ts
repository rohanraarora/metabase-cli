import type { MetabaseClient } from "../client.js";
import type { SearchResult, PaginatedResponse } from "../types.js";

export class SearchApi {
  constructor(private client: MetabaseClient) {}

  async search(
    query: string,
    params?: {
      models?: string[];
      limit?: number;
      offset?: number;
    },
  ): Promise<PaginatedResponse<SearchResult>> {
    const qs: Record<string, string> = { q: query };
    if (params?.models?.length) {
      qs.models = params.models.join(",");
    }
    if (params?.limit !== undefined) qs.limit = String(params.limit);
    if (params?.offset !== undefined) qs.offset = String(params.offset);

    return this.client.get("/api/search", qs);
  }
}

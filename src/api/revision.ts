import type { MetabaseClient } from "../client.js";

export class RevisionApi {
  constructor(private client: MetabaseClient) {}

  async list(entity: string, id: number): Promise<unknown[]> {
    return this.client.get<unknown[]>("/api/revision", {
      entity,
      id: String(id),
    });
  }

  async revert(entity: string, id: number, revisionId: number): Promise<unknown> {
    return this.client.post<unknown>("/api/revision/revert", {
      entity,
      id,
      revision_id: revisionId,
    });
  }
}

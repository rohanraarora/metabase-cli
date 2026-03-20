import type { MetabaseClient } from "../client.js";
import type { User } from "../types.js";

export class SessionApi {
  constructor(private client: MetabaseClient) {}

  async getCurrentUser(): Promise<User> {
    return this.client.get<User>("/api/user/current");
  }

  async getSessionProperties(): Promise<Record<string, unknown>> {
    return this.client.get("/api/session/properties");
  }
}

import type { MetabaseClient } from "../client.js";
import type { User, PaginatedResponse } from "../types.js";

export class UserApi {
  constructor(private client: MetabaseClient) {}

  async list(params?: Record<string, string>): Promise<PaginatedResponse<User>> {
    return this.client.get("/api/user", params);
  }

  async get(id: number): Promise<User> {
    return this.client.get<User>(`/api/user/${id}`);
  }

  async current(): Promise<User> {
    return this.client.get<User>("/api/user/current");
  }
}

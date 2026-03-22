import type { MetabaseClient } from "../client.js";

export interface RecentItem {
  model: string;
  id: number;
  name: string;
  timestamp: string;
}

export interface PopularItem {
  model: string;
  id: number;
  name: string;
}

export class ActivityApi {
  constructor(private client: MetabaseClient) {}

  async recentViews(context: "views" | "selections" = "views"): Promise<RecentItem[]> {
    const res = await this.client.get<{ recents: RecentItem[] }>("/api/activity/recents", {
      context: context,
    });
    return res.recents;
  }

  async popularItems(): Promise<PopularItem[]> {
    const res = await this.client.get<{ popular_items: PopularItem[] }>(
      "/api/activity/popular_items",
    );
    return res.popular_items;
  }
}

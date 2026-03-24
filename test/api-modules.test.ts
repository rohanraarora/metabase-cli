import { describe, it, expect, vi, afterEach } from "vitest";
import type { Profile } from "../src/types.js";

// Mock the config store
vi.mock("../src/config/store.js", () => ({
  updateProfile: vi.fn(),
  loadConfig: vi.fn(),
  saveConfig: vi.fn(),
  getActiveProfile: vi.fn(),
}));

import { MetabaseClient } from "../src/client.js";
import { AlertApi } from "../src/api/alert.js";
import { RevisionApi } from "../src/api/revision.js";
import { ActivityApi } from "../src/api/activity.js";
import { TimelineApi } from "../src/api/timeline.js";
import { SegmentApi } from "../src/api/segment.js";
import { NotificationApi } from "../src/api/notification.js";
import { DashboardApi } from "../src/api/dashboard.js";

function makeProfile(): Profile {
  return {
    name: "test",
    domain: "https://metabase.test.com",
    auth: { method: "session", email: "t@t.com", password: "s", sessionToken: "tok" },
  };
}

function mockFetch(response: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    text: () => Promise.resolve(JSON.stringify(response)),
  } as Response);
}

function mockFetchVoid() {
  return vi.fn().mockResolvedValue({
    ok: true,
    text: () => Promise.resolve(""),
  } as Response);
}

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

// ─── AlertApi ────────────────────────────────────────────────────────────────

describe("AlertApi", () => {
  it("list() → GET /api/alert", async () => {
    const client = new MetabaseClient(makeProfile());
    const api = new AlertApi(client);
    globalThis.fetch = mockFetch([{ id: 1 }]);

    const result = await api.list();

    const [url, opts] = (globalThis.fetch as any).mock.calls[0];
    expect(url).toBe("https://metabase.test.com/api/alert");
    expect(opts.method).toBe("GET");
    expect(result).toEqual([{ id: 1 }]);
  });

  it("get(1) → GET /api/alert/1", async () => {
    const client = new MetabaseClient(makeProfile());
    const api = new AlertApi(client);
    globalThis.fetch = mockFetch({ id: 1 });

    await api.get(1);

    const [url, opts] = (globalThis.fetch as any).mock.calls[0];
    expect(url).toBe("https://metabase.test.com/api/alert/1");
    expect(opts.method).toBe("GET");
  });

  it("create(params) → POST /api/alert", async () => {
    const client = new MetabaseClient(makeProfile());
    const api = new AlertApi(client);
    globalThis.fetch = mockFetch({ id: 1 });

    const params = {
      card: { id: 10 },
      alert_condition: "rows" as const,
      alert_first_only: false,
      channels: [{ channel_type: "email", enabled: true }],
    };
    await api.create(params);

    const [url, opts] = (globalThis.fetch as any).mock.calls[0];
    expect(url).toBe("https://metabase.test.com/api/alert");
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body)).toEqual(params);
  });

  it("update(1, params) → PUT /api/alert/1", async () => {
    const client = new MetabaseClient(makeProfile());
    const api = new AlertApi(client);
    globalThis.fetch = mockFetch({ id: 1 });

    const params = { alert_first_only: true };
    await api.update(1, params);

    const [url, opts] = (globalThis.fetch as any).mock.calls[0];
    expect(url).toBe("https://metabase.test.com/api/alert/1");
    expect(opts.method).toBe("PUT");
    expect(JSON.parse(opts.body)).toEqual(params);
  });

  it("delete(1) → DELETE /api/alert/1", async () => {
    const client = new MetabaseClient(makeProfile());
    const api = new AlertApi(client);
    globalThis.fetch = mockFetchVoid();

    await api.delete(1);

    const [url, opts] = (globalThis.fetch as any).mock.calls[0];
    expect(url).toBe("https://metabase.test.com/api/alert/1");
    expect(opts.method).toBe("DELETE");
  });
});

// ─── RevisionApi ─────────────────────────────────────────────────────────────

describe("RevisionApi", () => {
  it('list("card", 42) → GET /api/revision?entity=card&id=42', async () => {
    const client = new MetabaseClient(makeProfile());
    const api = new RevisionApi(client);
    globalThis.fetch = mockFetch([{ id: 123 }]);

    await api.list("card", 42);

    const [url, opts] = (globalThis.fetch as any).mock.calls[0];
    expect(url).toBe("https://metabase.test.com/api/revision?entity=card&id=42");
    expect(opts.method).toBe("GET");
  });

  it("revert() → POST /api/revision/revert", async () => {
    const client = new MetabaseClient(makeProfile());
    const api = new RevisionApi(client);
    globalThis.fetch = mockFetch({ id: 42 });

    await api.revert("card", 42, 123);

    const [url, opts] = (globalThis.fetch as any).mock.calls[0];
    expect(url).toBe("https://metabase.test.com/api/revision/revert");
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body)).toEqual({
      entity: "card",
      id: 42,
      revision_id: 123,
    });
  });
});

// ─── ActivityApi ─────────────────────────────────────────────────────────────

describe("ActivityApi", () => {
  it("recentViews() → GET /api/activity/recents, returns recents array", async () => {
    const client = new MetabaseClient(makeProfile());
    const api = new ActivityApi(client);
    const items = [{ model: "card", id: 1, name: "Q1", timestamp: "2024-01-01" }];
    globalThis.fetch = mockFetch({ recents: items });

    const result = await api.recentViews();

    const [url, opts] = (globalThis.fetch as any).mock.calls[0];
    expect(url).toBe("https://metabase.test.com/api/activity/recents?context=views");
    expect(opts.method).toBe("GET");
    expect(result).toEqual(items);
  });

  it("popularItems() → GET /api/activity/popular_items", async () => {
    const client = new MetabaseClient(makeProfile());
    const api = new ActivityApi(client);
    const items = [{ model: "card", id: 2, name: "Popular" }];
    globalThis.fetch = mockFetch({ popular_items: items });

    const result = await api.popularItems();

    const [url, opts] = (globalThis.fetch as any).mock.calls[0];
    expect(url).toBe("https://metabase.test.com/api/activity/popular_items");
    expect(opts.method).toBe("GET");
    expect(result).toEqual(items);
  });
});

// ─── TimelineApi ─────────────────────────────────────────────────────────────

describe("TimelineApi", () => {
  it("list() → GET /api/timeline", async () => {
    const client = new MetabaseClient(makeProfile());
    const api = new TimelineApi(client);
    globalThis.fetch = mockFetch([{ id: 1 }]);

    await api.list();

    const [url, opts] = (globalThis.fetch as any).mock.calls[0];
    expect(url).toBe("https://metabase.test.com/api/timeline");
    expect(opts.method).toBe("GET");
  });

  it("get(1) → GET /api/timeline/1", async () => {
    const client = new MetabaseClient(makeProfile());
    const api = new TimelineApi(client);
    globalThis.fetch = mockFetch({ id: 1 });

    await api.get(1);

    const [url, opts] = (globalThis.fetch as any).mock.calls[0];
    expect(url).toBe("https://metabase.test.com/api/timeline/1");
    expect(opts.method).toBe("GET");
  });

  it("create(params) → POST /api/timeline", async () => {
    const client = new MetabaseClient(makeProfile());
    const api = new TimelineApi(client);
    globalThis.fetch = mockFetch({ id: 1 });

    const params = { name: "My Timeline" };
    await api.create(params);

    const [url, opts] = (globalThis.fetch as any).mock.calls[0];
    expect(url).toBe("https://metabase.test.com/api/timeline");
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body)).toEqual(params);
  });

  it("update(1, params) → PUT /api/timeline/1", async () => {
    const client = new MetabaseClient(makeProfile());
    const api = new TimelineApi(client);
    globalThis.fetch = mockFetch({ id: 1 });

    const params = { name: "Updated Timeline" };
    await api.update(1, params);

    const [url, opts] = (globalThis.fetch as any).mock.calls[0];
    expect(url).toBe("https://metabase.test.com/api/timeline/1");
    expect(opts.method).toBe("PUT");
    expect(JSON.parse(opts.body)).toEqual(params);
  });

  it("delete(1) → DELETE /api/timeline/1", async () => {
    const client = new MetabaseClient(makeProfile());
    const api = new TimelineApi(client);
    globalThis.fetch = mockFetchVoid();

    await api.delete(1);

    const [url, opts] = (globalThis.fetch as any).mock.calls[0];
    expect(url).toBe("https://metabase.test.com/api/timeline/1");
    expect(opts.method).toBe("DELETE");
  });

  it("createEvent(params) → POST /api/timeline-event", async () => {
    const client = new MetabaseClient(makeProfile());
    const api = new TimelineApi(client);
    globalThis.fetch = mockFetch({ id: 1 });

    const params = { timeline_id: 1, name: "Event", timestamp: "2024-01-01T00:00:00Z" };
    await api.createEvent(params);

    const [url, opts] = (globalThis.fetch as any).mock.calls[0];
    expect(url).toBe("https://metabase.test.com/api/timeline-event");
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body)).toEqual(params);
  });

  it("updateEvent(1, params) → PUT /api/timeline-event/1", async () => {
    const client = new MetabaseClient(makeProfile());
    const api = new TimelineApi(client);
    globalThis.fetch = mockFetch({ id: 1 });

    const params = { name: "Updated Event" };
    await api.updateEvent(1, params);

    const [url, opts] = (globalThis.fetch as any).mock.calls[0];
    expect(url).toBe("https://metabase.test.com/api/timeline-event/1");
    expect(opts.method).toBe("PUT");
    expect(JSON.parse(opts.body)).toEqual(params);
  });

  it("deleteEvent(1) → DELETE /api/timeline-event/1", async () => {
    const client = new MetabaseClient(makeProfile());
    const api = new TimelineApi(client);
    globalThis.fetch = mockFetchVoid();

    await api.deleteEvent(1);

    const [url, opts] = (globalThis.fetch as any).mock.calls[0];
    expect(url).toBe("https://metabase.test.com/api/timeline-event/1");
    expect(opts.method).toBe("DELETE");
  });
});

// ─── SegmentApi ──────────────────────────────────────────────────────────────

describe("SegmentApi", () => {
  it("list() → GET /api/segment", async () => {
    const client = new MetabaseClient(makeProfile());
    const api = new SegmentApi(client);
    globalThis.fetch = mockFetch([{ id: 1 }]);

    await api.list();

    const [url, opts] = (globalThis.fetch as any).mock.calls[0];
    expect(url).toBe("https://metabase.test.com/api/segment");
    expect(opts.method).toBe("GET");
  });

  it("get(1) → GET /api/segment/1", async () => {
    const client = new MetabaseClient(makeProfile());
    const api = new SegmentApi(client);
    globalThis.fetch = mockFetch({ id: 1 });

    await api.get(1);

    const [url, opts] = (globalThis.fetch as any).mock.calls[0];
    expect(url).toBe("https://metabase.test.com/api/segment/1");
    expect(opts.method).toBe("GET");
  });

  it("create(params) → POST /api/segment", async () => {
    const client = new MetabaseClient(makeProfile());
    const api = new SegmentApi(client);
    globalThis.fetch = mockFetch({ id: 1 });

    const params = {
      name: "Active Users",
      table_id: 5,
      definition: { filter: ["=", ["field", 10], true] },
    };
    await api.create(params);

    const [url, opts] = (globalThis.fetch as any).mock.calls[0];
    expect(url).toBe("https://metabase.test.com/api/segment");
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body)).toEqual(params);
  });

  it("update(1, params) → PUT /api/segment/1", async () => {
    const client = new MetabaseClient(makeProfile());
    const api = new SegmentApi(client);
    globalThis.fetch = mockFetch({ id: 1 });

    const params = { name: "Updated Segment", revision_message: "renamed" };
    await api.update(1, params);

    const [url, opts] = (globalThis.fetch as any).mock.calls[0];
    expect(url).toBe("https://metabase.test.com/api/segment/1");
    expect(opts.method).toBe("PUT");
    expect(JSON.parse(opts.body)).toEqual(params);
  });

  it("delete(1) → DELETE /api/segment/1?revision_message=Deleted+via+CLI", async () => {
    const client = new MetabaseClient(makeProfile());
    const api = new SegmentApi(client);
    globalThis.fetch = mockFetchVoid();

    await api.delete(1);

    const [url, opts] = (globalThis.fetch as any).mock.calls[0];
    expect(url).toBe("https://metabase.test.com/api/segment/1?revision_message=Deleted+via+CLI");
    expect(opts.method).toBe("DELETE");
  });
});

// ─── NotificationApi ─────────────────────────────────────────────────────────

describe("NotificationApi", () => {
  it("list() → GET /api/notification", async () => {
    const client = new MetabaseClient(makeProfile());
    const api = new NotificationApi(client);
    globalThis.fetch = mockFetch([{ id: 1 }]);

    await api.list();

    const [url, opts] = (globalThis.fetch as any).mock.calls[0];
    expect(url).toBe("https://metabase.test.com/api/notification");
    expect(opts.method).toBe("GET");
  });

  it("get(1) → GET /api/notification/1", async () => {
    const client = new MetabaseClient(makeProfile());
    const api = new NotificationApi(client);
    globalThis.fetch = mockFetch({ id: 1 });

    await api.get(1);

    const [url, opts] = (globalThis.fetch as any).mock.calls[0];
    expect(url).toBe("https://metabase.test.com/api/notification/1");
    expect(opts.method).toBe("GET");
  });

  it("create(params) → POST /api/notification", async () => {
    const client = new MetabaseClient(makeProfile());
    const api = new NotificationApi(client);
    globalThis.fetch = mockFetch({ id: 1 });

    const params = {
      payload_type: "question",
      payload: { card_id: 10 },
      handlers: [{ channel_type: "email", recipients: [{ type: "user", user_id: 1 }] }],
      active: true,
    };
    await api.create(params);

    const [url, opts] = (globalThis.fetch as any).mock.calls[0];
    expect(url).toBe("https://metabase.test.com/api/notification");
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body)).toEqual(params);
  });

  it("update(1, params) → PUT /api/notification/1", async () => {
    const client = new MetabaseClient(makeProfile());
    const api = new NotificationApi(client);
    globalThis.fetch = mockFetch({ id: 1 });

    const params = { active: false };
    await api.update(1, params);

    const [url, opts] = (globalThis.fetch as any).mock.calls[0];
    expect(url).toBe("https://metabase.test.com/api/notification/1");
    expect(opts.method).toBe("PUT");
    expect(JSON.parse(opts.body)).toEqual(params);
  });

  it("send(1) → POST /api/notification/1/send", async () => {
    const client = new MetabaseClient(makeProfile());
    const api = new NotificationApi(client);
    globalThis.fetch = mockFetch({});

    await api.send(1);

    const [url, opts] = (globalThis.fetch as any).mock.calls[0];
    expect(url).toBe("https://metabase.test.com/api/notification/1/send");
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body)).toEqual({});
  });
});

// ─── DashboardApi (dashcards update) ─────────────────────────────────────────

describe("DashboardApi", () => {
  it("update(1, { dashcards }) → PUT /api/dashboard/1 with dashcards in body", async () => {
    const client = new MetabaseClient(makeProfile());
    const api = new DashboardApi(client);
    globalThis.fetch = mockFetch({ id: 1 });

    const dashcards = [{ id: -1, card_id: 5, row: 0, col: 0, size_x: 6, size_y: 4 }];
    await api.update(1, { dashcards });

    const [url, opts] = (globalThis.fetch as any).mock.calls[0];
    expect(url).toBe("https://metabase.test.com/api/dashboard/1");
    expect(opts.method).toBe("PUT");
    expect(JSON.parse(opts.body)).toEqual({ dashcards });
  });

  it("update(1, { parameters }) → PUT /api/dashboard/1 with parameters in body", async () => {
    const client = new MetabaseClient(makeProfile());
    const api = new DashboardApi(client);
    globalThis.fetch = mockFetch({ id: 1 });

    const parameters = [
      { id: "abc123", type: "date/single", name: "Start Date", slug: "start_date", default: "2026-01-01" },
    ];
    await api.update(1, { parameters });

    const [url, opts] = (globalThis.fetch as any).mock.calls[0];
    expect(url).toBe("https://metabase.test.com/api/dashboard/1");
    expect(opts.method).toBe("PUT");
    expect(JSON.parse(opts.body)).toEqual({ parameters });
  });

  it("update(1, { parameters, dashcards }) → PUT with both parameters and dashcards with mappings", async () => {
    const client = new MetabaseClient(makeProfile());
    const api = new DashboardApi(client);
    globalThis.fetch = mockFetch({ id: 1 });

    const parameters = [
      { id: "p1", type: "date/single", name: "Start Date", slug: "start_date" },
    ];
    const dashcards = [
      {
        id: 100,
        card_id: 42,
        row: 0,
        col: 0,
        size_x: 6,
        size_y: 4,
        parameter_mappings: [
          { parameter_id: "p1", card_id: 42, target: ["variable", ["template-tag", "start_date"]] },
        ],
      },
    ];
    await api.update(1, { parameters, dashcards });

    const [, opts] = (globalThis.fetch as any).mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.parameters).toEqual(parameters);
    expect(body.dashcards[0].parameter_mappings).toEqual([
      { parameter_id: "p1", card_id: 42, target: ["variable", ["template-tag", "start_date"]] },
    ]);
  });

  it("update(1, { parameters }) with values_source_config → sends source config in body", async () => {
    const client = new MetabaseClient(makeProfile());
    const api = new DashboardApi(client);
    globalThis.fetch = mockFetch({ id: 1 });

    const parameters = [
      {
        id: "p2",
        type: "string/=",
        name: "Channel",
        slug: "channel",
        values_source_type: "card",
        values_source_config: {
          card_id: 99,
          value_field: ["field", "channel", { "base-type": "type/Text" }],
        },
      },
    ];
    await api.update(1, { parameters });

    const [, opts] = (globalThis.fetch as any).mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.parameters[0].values_source_type).toBe("card");
    expect(body.parameters[0].values_source_config.card_id).toBe(99);
  });
});

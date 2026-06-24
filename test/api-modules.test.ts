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
import { NotificationApi, canonicalizeChannelType } from "../src/api/notification.js";
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

/** Returns each response in order — for read-modify-write calls (GET then PUT). */
function mockFetchSeq(responses: unknown[]) {
  const fn = vi.fn();
  for (const r of responses) {
    fn.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(r)),
    } as Response);
  }
  return fn;
}

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

// ─── AlertApi ────────────────────────────────────────────────────────────────

describe("AlertApi", () => {
  it("list() → GET /api/notification with payload_type query param", async () => {
    const client = new MetabaseClient(makeProfile());
    const api = new AlertApi(client);
    globalThis.fetch = mockFetch([{ id: 1 }]);

    const result = await api.list();

    const [url, opts] = (globalThis.fetch as any).mock.calls[0];
    expect(url).toBe("https://metabase.test.com/api/notification?payload_type=notification%2Fcard");
    expect(opts.method).toBe("GET");
    expect(result).toEqual([{ id: 1 }]);
  });

  it("get(1) → GET /api/notification/1", async () => {
    const client = new MetabaseClient(makeProfile());
    const api = new AlertApi(client);
    globalThis.fetch = mockFetch({ id: 1 });

    await api.get(1);

    const [url, opts] = (globalThis.fetch as any).mock.calls[0];
    expect(url).toBe("https://metabase.test.com/api/notification/1");
    expect(opts.method).toBe("GET");
  });

  it("create(params) → POST /api/notification with v0.59+ translated body", async () => {
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
    expect(url).toBe("https://metabase.test.com/api/notification");
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body)).toEqual({
      payload_type: "notification/card",
      payload: {
        card_id: 10,
        send_condition: "has_result",
        send_once: false,
      },
      // Channel type is canonicalized to the v0.59+ "channel/<type>" form.
      handlers: [{ channel_type: "channel/email", recipients: [] }],
      active: true,
    });
  });

  it("create(slack) → emits raw-value recipient + top-level cron subscription", async () => {
    const client = new MetabaseClient(makeProfile());
    const api = new AlertApi(client);
    globalThis.fetch = mockFetch({ id: 2 });

    const params = {
      card: { id: 10 },
      alert_condition: "rows" as const,
      alert_first_only: false,
      channels: [
        {
          channel_type: "slack",
          enabled: true,
          details: { channel: "#alerts" },
          schedule_type: "hourly" as const,
        },
      ],
    };
    await api.create(params);

    const [, opts] = (globalThis.fetch as any).mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.handlers).toEqual([
      {
        channel_type: "channel/slack",
        recipients: [
          {
            type: "notification-recipient/raw-value",
            details: { value: "#alerts" },
          },
        ],
      },
    ]);
    // Schedule lives on top-level subscriptions[], not on the handler.
    expect(body.subscriptions).toEqual([
      { type: "notification-subscription/cron", cron_schedule: "0 0 * * * ?" },
    ]);
  });

  // A representative hydrated notification, as returned by GET. The CLI must
  // read this, merge the requested change, and PUT the whole thing back WITH
  // the existing ids intact — the server diffs nested rows by :id, so dropping
  // them triggers a destructive delete+recreate.
  const currentNotification = {
    id: 1,
    payload_type: "notification/card",
    creator_id: 4,
    payload: {
      id: 100,
      card_id: 10,
      send_condition: "has_result",
      send_once: false,
      card: { id: 10, name: "Q" }, // hydrated junk that must be stripped
    },
    handlers: [
      {
        id: 5,
        notification_id: 1,
        channel_type: "channel/slack",
        active: true,
        channel: { id: 3 }, // hydration, must be stripped
        template: null,
        recipients: [
          {
            id: 9,
            notification_handler_id: 5,
            type: "notification-recipient/raw-value",
            details: { value: "#alerts" },
            user: null, // hydration, must be stripped
          },
        ],
      },
    ],
    subscriptions: [
      {
        id: 7,
        notification_id: 1,
        type: "notification-subscription/cron",
        cron_schedule: "0 0 3 * * ?",
        ui_display_type: "cron/builder",
        event_name: null,
      },
    ],
    active: true,
    creator: { id: 4 }, // hydration, must be stripped
  };

  it("update(1, {first_only}) → PUT full body, ids preserved, hydration stripped", async () => {
    const client = new MetabaseClient(makeProfile());
    const api = new AlertApi(client);
    globalThis.fetch = mockFetchSeq([currentNotification, { id: 1 }]);

    await api.update(1, { alert_first_only: true });

    const calls = (globalThis.fetch as any).mock.calls;
    expect(calls[0][1].method).toBe("GET");
    const [url, opts] = calls[1];
    expect(url).toBe("https://metabase.test.com/api/notification/1");
    expect(opts.method).toBe("PUT");
    expect(JSON.parse(opts.body)).toEqual({
      payload_type: "notification/card",
      id: 1,
      creator_id: 4,
      active: true,
      payload: { id: 100, card_id: 10, send_condition: "has_result", send_once: true },
      handlers: [
        {
          id: 5,
          notification_id: 1,
          channel_type: "channel/slack",
          active: true,
          recipients: [
            {
              id: 9,
              notification_handler_id: 5,
              type: "notification-recipient/raw-value",
              details: { value: "#alerts" },
            },
          ],
        },
      ],
      subscriptions: [
        {
          id: 7,
          notification_id: 1,
          type: "notification-subscription/cron",
          cron_schedule: "0 0 3 * * ?",
          ui_display_type: "cron/builder",
        },
      ],
    });
  });

  it("update with only alert_above_goal → send_condition goal_above, payload id kept", async () => {
    const client = new MetabaseClient(makeProfile());
    const api = new AlertApi(client);
    globalThis.fetch = mockFetchSeq([currentNotification, { id: 1 }]);

    // Passing --above-goal without --condition must imply a goal condition;
    // falling back to "rows" would silently map a goal alert to has_result.
    await api.update(1, { alert_above_goal: true });

    const [, opts] = (globalThis.fetch as any).mock.calls[1];
    expect(JSON.parse(opts.body).payload).toEqual({
      id: 100,
      card_id: 10,
      send_condition: "goal_above",
      send_once: false,
    });
  });

  it("update(1, {cron}) → keeps existing handler, updates the same subscription in place", async () => {
    const client = new MetabaseClient(makeProfile());
    const api = new AlertApi(client);
    globalThis.fetch = mockFetchSeq([currentNotification, { id: 1 }]);

    await api.update(1, { cron: "0 30 * * * ?" });

    const body = JSON.parse((globalThis.fetch as any).mock.calls[1][1].body);
    // Handler untouched (full, with ids)...
    expect(body.handlers[0].id).toBe(5);
    expect(body.handlers[0].recipients[0].details).toEqual({ value: "#alerts" });
    // ...the existing subscription (id 7) is updated in place, not replaced.
    expect(body.subscriptions).toEqual([
      { type: "notification-subscription/cron", cron_schedule: "0 30 * * * ?", id: 7 },
    ]);
    // Payload preserved unchanged (with id).
    expect(body.payload).toEqual({
      id: 100,
      card_id: 10,
      send_condition: "has_result",
      send_once: false,
    });
  });

  it("delete(1) → PUT full body (ids preserved) with active:false (archive in place)", async () => {
    const client = new MetabaseClient(makeProfile());
    const api = new AlertApi(client);
    globalThis.fetch = mockFetchSeq([currentNotification, {}]);

    await api.delete(1);

    const calls = (globalThis.fetch as any).mock.calls;
    expect(calls[0][1].method).toBe("GET");
    const [url, opts] = calls[1];
    expect(url).toBe("https://metabase.test.com/api/notification/1");
    expect(opts.method).toBe("PUT");
    const body = JSON.parse(opts.body);
    expect(body.active).toBe(false);
    expect(body.payload.id).toBe(100);
    expect(body.handlers[0].id).toBe(5);
    expect(body.subscriptions[0].id).toBe(7);
  });

  it("delete(1) → throws for a corrupt null-payload orphan (no destructive PUT)", async () => {
    const client = new MetabaseClient(makeProfile());
    const api = new AlertApi(client);
    const orphan = {
      id: 38,
      payload_type: "notification/card",
      payload: null,
      handlers: [],
      subscriptions: [
        { id: 1, type: "notification-subscription/cron", cron_schedule: "0 30 * * * ?" },
      ],
      active: true,
    };
    globalThis.fetch = mockFetchSeq([orphan]);

    await expect(api.delete(38)).rejects.toThrow(/orphan/i);
    // Only the GET happened — no PUT that could corrupt state further.
    expect((globalThis.fetch as any).mock.calls).toHaveLength(1);
    expect((globalThis.fetch as any).mock.calls[0][1].method).toBe("GET");
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

  it("delete(1) → PUT /api/segment/1 with archived flag", async () => {
    const client = new MetabaseClient(makeProfile());
    const api = new SegmentApi(client);
    globalThis.fetch = mockFetch({});

    await api.delete(1);

    const [url, opts] = (globalThis.fetch as any).mock.calls[0];
    expect(url).toBe("https://metabase.test.com/api/segment/1");
    expect(opts.method).toBe("PUT");
    expect(JSON.parse(opts.body)).toEqual({ archived: true, revision_message: "Archived via CLI" });
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

  it("update(1, {active:false}) → GET then PUT the full id-preserving body with active:false", async () => {
    const client = new MetabaseClient(makeProfile());
    const api = new NotificationApi(client);
    const current = {
      id: 1,
      payload_type: "notification/card",
      creator_id: 4,
      payload: { id: 100, card_id: 10, send_condition: "has_result", card: { id: 10 } },
      handlers: [
        {
          id: 5,
          channel_type: "channel/email",
          recipients: [{ id: 9, type: "notification-recipient/user", user_id: 3 }],
        },
      ],
      subscriptions: [
        { id: 7, type: "notification-subscription/cron", cron_schedule: "0 0 * * * ?" },
      ],
      active: true,
    };
    globalThis.fetch = mockFetchSeq([current, { id: 1 }]);

    await api.update(1, { active: false });

    const calls = (globalThis.fetch as any).mock.calls;
    expect(calls[0][1].method).toBe("GET");
    const [url, opts] = calls[1];
    expect(url).toBe("https://metabase.test.com/api/notification/1");
    expect(opts.method).toBe("PUT");
    expect(JSON.parse(opts.body)).toEqual({
      payload_type: "notification/card",
      id: 1,
      creator_id: 4,
      payload: { id: 100, card_id: 10, send_condition: "has_result" },
      handlers: [
        {
          id: 5,
          channel_type: "channel/email",
          recipients: [{ id: 9, type: "notification-recipient/user", user_id: 3 }],
        },
      ],
      subscriptions: [
        { id: 7, type: "notification-subscription/cron", cron_schedule: "0 0 * * * ?" },
      ],
      active: false,
    });
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

// ─── canonicalizeChannelType ─────────────────────────────────────────────────

describe("canonicalizeChannelType", () => {
  it("prefixes bare channel types", () => {
    expect(canonicalizeChannelType("slack")).toBe("channel/slack");
    expect(canonicalizeChannelType("email")).toBe("channel/email");
  });

  it("is idempotent on already-prefixed types (so validation matches either form)", () => {
    expect(canonicalizeChannelType("channel/slack")).toBe("channel/slack");
    expect(canonicalizeChannelType("channel/email")).toBe("channel/email");
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
      {
        id: "abc123",
        type: "date/single",
        name: "Start Date",
        slug: "start_date",
        default: "2026-01-01",
      },
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

    const parameters = [{ id: "p1", type: "date/single", name: "Start Date", slug: "start_date" }];
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

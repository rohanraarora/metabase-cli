import type { MetabaseClient } from "../client.js";

// Metabase v0.59+ notification API
// (replaces the legacy /api/alert + /api/pulse endpoints).
//
// The shape mirrors the wire format the server actually accepts -- not the
// pre-v0.59 alert shape with `channels[]` and `schedule_type` at the top
// level. Three things that have moved:
//
//   1. channel_type now requires the `channel/` prefix
//      ("channel/email", "channel/slack"). The bare values "email" / "slack"
//      are rejected with 400 -- the canonicalize helper accepts both.
//   2. Schedule lives on top-level `subscriptions[]`, not on handlers.
//      Use `notification-subscription/cron` with a cron_schedule string.
//   3. Slack channel names go through a `notification-recipient/raw-value`
//      recipient with `details.value: "#channel"`. The legacy user-id
//      recipient (`notification-recipient/user`) is still used for email.

export type NotificationChannelType = "channel/email" | "channel/slack" | (string & {});
export type NotificationRecipientType =
  | "notification-recipient/user"
  | "notification-recipient/raw-value";

export type NotificationSendCondition = "has_result" | "goal_above" | "goal_below";

export interface NotificationRecipient {
  type: NotificationRecipientType | (string & {});
  /** Existing-row id, kept on update so the server matches it in place. */
  id?: number;
  notification_handler_id?: number;
  /** Present when type === "notification-recipient/user" */
  user_id?: number;
  /** Present when type === "notification-recipient/raw-value" (e.g. Slack channel name). */
  details?: { value: string };
  /** Present for group recipients (notification-recipient/group). */
  permissions_group_id?: number;
}

export interface NotificationHandler {
  channel_type: NotificationChannelType;
  channel_id?: number | null;
  recipients?: NotificationRecipient[];
  template_id?: number | null;
  /** Existing-row ids, kept on update so the server matches the handler in place. */
  id?: number;
  notification_id?: number;
  active?: boolean;
}

export interface NotificationCronSubscription {
  type: "notification-subscription/cron";
  cron_schedule: string;
  ui_display_type?: string;
  /** Existing-row ids, kept on update so the server matches the subscription in place. */
  id?: number;
  notification_id?: number;
  event_name?: string | null;
}

export type NotificationSubscription = NotificationCronSubscription;

export interface NotificationCardPayload {
  card_id: number;
  /** Existing-row id, kept on update so the server matches the payload in place. */
  id?: number;
  /** When true, send once and stop. Equivalent of the old `alert_first_only`. */
  send_once?: boolean;
  /**
   * has_result -- alert when the question returns any rows
   * goal_above -- alert when the metric crosses above a numeric goal
   * goal_below -- alert when the metric crosses below a numeric goal
   * Equivalent of the old `alert_condition` + `alert_above_goal`.
   */
  send_condition?: NotificationSendCondition;
  disable_links?: boolean;
}

export interface CreateNotificationParams {
  payload_type: "notification/card";
  payload: NotificationCardPayload;
  handlers: NotificationHandler[];
  subscriptions?: NotificationSubscription[];
  active: boolean;
}

export interface UpdateNotificationParams {
  id?: number;
  creator_id?: number;
  payload_type?: "notification/card";
  /**
   * `null` is valid (and preserved) — a malformed/orphan notification can carry
   * a null payload, and the v0.59+ schema allows the top-level :payload to be null.
   */
  payload?: Partial<NotificationCardPayload> | null;
  handlers?: NotificationHandler[];
  subscriptions?: NotificationSubscription[];
  active?: boolean;
}

/**
 * Accepts both the bare ("slack", "email") and prefixed
 * ("channel/slack", "channel/email") forms, and always returns the prefixed
 * form the v0.59+ API expects.
 */
export function canonicalizeChannelType(raw: string): NotificationChannelType {
  if (raw.startsWith("channel/")) return raw as NotificationChannelType;
  return `channel/${raw}` as NotificationChannelType;
}

/** Build a Slack-channel-name recipient (raw-value, with details.value). */
export function slackChannelRecipient(channelName: string): NotificationRecipient {
  const value = channelName.startsWith("#") ? channelName : `#${channelName}`;
  return {
    type: "notification-recipient/raw-value",
    details: { value },
  };
}

/** Build a user-id recipient (used by email handlers, occasionally Slack DMs). */
export function userRecipient(userId: number): NotificationRecipient {
  return {
    type: "notification-recipient/user",
    user_id: userId,
  };
}

/** Build a top-level cron subscription. */
export function cronSubscription(cron: string): NotificationCronSubscription {
  return {
    type: "notification-subscription/cron",
    cron_schedule: cron,
  };
}

// ── Read-modify-write helpers ────────────────────────────────────────────────
//
// Metabase v0.59+ rejects a partial PUT to /api/notification/:id: the body must
// be the FULL notification (it dispatches on :payload_type, so a bare
// `{active:false}` 400s with "invalid dispatch value"; omitting :payload 400s
// with "missing required key"). To update one field you must read the current
// notification, change that field, and send the whole thing back.
//
// Crucially the server's update (models.util.spec-update/do-update!) diffs the
// nested handlers / subscriptions / payload BY THEIR :id: a child present in the
// DB but absent (or id-less) in the body is DELETED and a fresh one inserted.
// Stripping the ids therefore triggers a destructive delete+recreate that, on
// v0.59.x, leaves a card-less orphan and 404s. So we must PRESERVE every id and
// update entities in place — exactly what the web UI sends back. We only drop
// the heavy read-only hydration (`payload.card`, `handler.channel/template`,
// `recipient.user`) the update schema doesn't need.

/** Update-ready recipient: keep ids + identity, drop the hydrated `user` object. */
export function toUpdateRecipient(r: Record<string, unknown>): NotificationRecipient {
  const out: NotificationRecipient = { type: r.type as NotificationRecipient["type"] };
  if (r.id != null) out.id = r.id as number;
  if (r.notification_handler_id != null)
    out.notification_handler_id = r.notification_handler_id as number;
  if (r.user_id != null) out.user_id = r.user_id as number;
  if (r.details && typeof r.details === "object") out.details = r.details as { value: string };
  if (r.permissions_group_id != null) out.permissions_group_id = r.permissions_group_id as number;
  return out;
}

/** Update-ready handler: keep ids, drop the hydrated `channel`/`template` objects. */
export function toUpdateHandler(h: Record<string, unknown>): NotificationHandler {
  const handler: NotificationHandler = {
    channel_type: h.channel_type as NotificationChannelType,
    recipients: Array.isArray(h.recipients)
      ? (h.recipients as Record<string, unknown>[]).map(toUpdateRecipient)
      : [],
  };
  if (h.id != null) handler.id = h.id as number;
  if (h.notification_id != null) handler.notification_id = h.notification_id as number;
  if (h.channel_id != null) handler.channel_id = h.channel_id as number;
  if (h.template_id != null) handler.template_id = h.template_id as number;
  if (h.active != null) handler.active = h.active as boolean;
  return handler;
}

/** Update-ready cron subscription: keep its id so it updates in place. */
export function toUpdateSubscription(s: Record<string, unknown>): NotificationSubscription {
  const sub: NotificationCronSubscription = {
    type: (s.type as NotificationCronSubscription["type"]) ?? "notification-subscription/cron",
    cron_schedule: s.cron_schedule as string,
  };
  if (s.id != null) sub.id = s.id as number;
  if (s.notification_id != null) sub.notification_id = s.notification_id as number;
  if (s.event_name != null) sub.event_name = s.event_name as string;
  if (typeof s.ui_display_type === "string") sub.ui_display_type = s.ui_display_type;
  return sub;
}

/**
 * Turn a fetched notification (the hydrated GET shape) into a full, id-preserving
 * update body the v0.59+ PUT accepts. Preserves a null payload as-is so a
 * malformed/orphan notification can still be archived.
 */
export function notificationToUpdateBody(
  current: Record<string, unknown>,
): UpdateNotificationParams {
  const body: UpdateNotificationParams = {
    payload_type: (current.payload_type as "notification/card") ?? "notification/card",
    active: current.active as boolean,
  };
  if (current.id != null) body.id = current.id as number;
  if (current.creator_id != null) body.creator_id = current.creator_id as number;

  if (current.payload === null) {
    body.payload = null;
  } else if (current.payload && typeof current.payload === "object") {
    const p = current.payload as Record<string, unknown>;
    const payload: Partial<NotificationCardPayload> = { card_id: p.card_id as number };
    if (p.id != null) payload.id = p.id as number;
    if (p.send_condition !== undefined)
      payload.send_condition = p.send_condition as NotificationSendCondition;
    if (p.send_once !== undefined) payload.send_once = p.send_once as boolean;
    if (p.disable_links !== undefined) payload.disable_links = p.disable_links as boolean;
    body.payload = payload;
  }

  if (Array.isArray(current.handlers)) {
    body.handlers = (current.handlers as Record<string, unknown>[]).map(toUpdateHandler);
  }
  if (Array.isArray(current.subscriptions)) {
    body.subscriptions = (current.subscriptions as Record<string, unknown>[]).map(
      toUpdateSubscription,
    );
  }
  return body;
}

/**
 * Merge changes onto a normalized base body, updating entities IN PLACE so the
 * server matches them by id (avoiding the delete+recreate that corrupts the
 * notification). `payload` is shallow-merged (keeping its id). New handlers /
 * subscriptions are aligned positionally with the existing ones so they inherit
 * the existing ids and update in place rather than replacing.
 */
export function mergeNotificationUpdate(
  base: UpdateNotificationParams,
  changes: UpdateNotificationParams,
): UpdateNotificationParams {
  const merged: UpdateNotificationParams = {
    ...base,
    payload_type: changes.payload_type ?? base.payload_type,
  };

  if (changes.payload !== undefined) {
    merged.payload =
      base.payload && changes.payload ? { ...base.payload, ...changes.payload } : changes.payload;
  }

  if (changes.handlers !== undefined) {
    merged.handlers = changes.handlers.map((h, i) => inheritId(h, base.handlers?.[i]));
  }

  if (changes.subscriptions !== undefined) {
    merged.subscriptions = changes.subscriptions.map((s, i) =>
      inheritId(s, base.subscriptions?.[i]),
    );
  }

  if (changes.active !== undefined) merged.active = changes.active;

  return merged;
}

/** Carry the existing row's id onto a replacement so the server updates in place. */
function inheritId<T>(next: T, existing: T | undefined): T {
  const id = (existing as Record<string, unknown> | undefined)?.id;
  return id != null ? ({ ...next, id } as T) : next;
}

export class NotificationApi {
  constructor(private client: MetabaseClient) {}

  async list(): Promise<unknown[]> {
    return this.client.get<unknown[]>("/api/notification");
  }

  async get(id: number): Promise<unknown> {
    return this.client.get<unknown>(`/api/notification/${id}`);
  }

  async create(params: CreateNotificationParams): Promise<unknown> {
    return this.client.post<unknown>("/api/notification", params);
  }

  /**
   * Update a notification. v0.59+ requires the full object on PUT, so this
   * reads the current notification, merges the requested changes, and sends the
   * whole thing back — partial bodies (e.g. just `{active:false}`) are rejected.
   */
  async update(id: number, params: UpdateNotificationParams): Promise<unknown> {
    const current = (await this.get(id)) as Record<string, unknown>;
    const body = mergeNotificationUpdate(notificationToUpdateBody(current), params);
    return this.client.put<unknown>(`/api/notification/${id}`, body);
  }

  async send(id: number): Promise<void> {
    await this.client.post<unknown>(`/api/notification/${id}/send`, {});
  }
}

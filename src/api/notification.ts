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
  type: NotificationRecipientType;
  /** Present when type === "notification-recipient/user" */
  user_id?: number;
  /** Present when type === "notification-recipient/raw-value" (e.g. Slack channel name). */
  details?: { value: string };
}

export interface NotificationHandler {
  channel_type: NotificationChannelType;
  channel_id?: number | null;
  recipients?: NotificationRecipient[];
  template_id?: number | null;
}

export interface NotificationCronSubscription {
  type: "notification-subscription/cron";
  cron_schedule: string;
  ui_display_type?: string;
}

export type NotificationSubscription = NotificationCronSubscription;

export interface NotificationCardPayload {
  card_id: number;
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
  payload_type?: "notification/card";
  payload?: Partial<NotificationCardPayload>;
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

  async update(id: number, params: UpdateNotificationParams): Promise<unknown> {
    return this.client.put<unknown>(`/api/notification/${id}`, params);
  }

  async send(id: number): Promise<void> {
    await this.client.post<unknown>(`/api/notification/${id}/send`, {});
  }
}

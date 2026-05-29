import type { MetabaseClient } from "../client.js";
import {
  canonicalizeChannelType,
  cronSubscription,
  type NotificationHandler,
  type NotificationRecipient,
  type NotificationSendCondition,
  type NotificationSubscription,
  slackChannelRecipient,
  userRecipient,
} from "./notification.js";

export interface AlertChannel {
  channel_type: string;
  enabled: boolean;
  /** User-id recipients (email handlers, occasionally Slack DMs). */
  recipients?: { id: number }[];
  /**
   * Slack channel name (e.g. "#alerts"). The legacy API put this on
   * `details.channel`; the v0.59+ API expects a raw-value recipient with
   * `details.value`. The CLI normalizes either form into the new shape.
   */
  details?: { channel?: string; [k: string]: unknown };
  /** Legacy cadence fields, kept for back-compat with pre-v0.59 callers. */
  schedule_type?: "hourly" | "daily" | "weekly" | "monthly" | string;
  schedule_hour?: number;
  schedule_day?: string;
  /** Cron schedule (Quartz/Spring). Preferred over schedule_type on v0.59+. */
  cron_schedule?: string;
}

export interface CreateAlertParams {
  card: { id: number };
  alert_condition: "rows" | "goal";
  alert_first_only: boolean;
  alert_above_goal?: boolean;
  channels: AlertChannel[];
}

export interface UpdateAlertParams {
  card?: { id: number };
  alert_condition?: "rows" | "goal";
  alert_first_only?: boolean;
  alert_above_goal?: boolean;
  channels?: AlertChannel[];
}

interface NotificationPayload {
  card_id: number;
  send_once?: boolean;
  send_condition?: NotificationSendCondition;
}

interface NotificationCreateBody {
  payload_type: "notification/card";
  payload: NotificationPayload;
  handlers: NotificationHandler[];
  subscriptions?: NotificationSubscription[];
  active: boolean;
}

interface NotificationUpdateBody {
  payload_type?: "notification/card";
  payload?: Partial<NotificationPayload>;
  handlers?: NotificationHandler[];
  subscriptions?: NotificationSubscription[];
  active?: boolean;
}

function mapSendCondition(
  condition: "rows" | "goal",
  aboveGoal?: boolean,
): NotificationSendCondition {
  if (condition === "rows") return "has_result";
  return aboveGoal ? "goal_above" : "goal_below";
}

// Translate the legacy schedule_type/schedule_hour shape into a cron expression
// the new subscriptions[] API understands. Returns undefined if the channel
// carries no schedule info.
function channelToCron(ch: AlertChannel): string | undefined {
  if (ch.cron_schedule) return ch.cron_schedule;
  const t = ch.schedule_type;
  if (!t) return undefined;
  // Quartz/Spring cron: seconds minutes hours day-of-month month day-of-week
  const hour = ch.schedule_hour ?? 0;
  switch (t) {
    case "hourly":
      return "0 0 * * * ?";
    case "daily":
      return `0 0 ${hour} * * ?`;
    case "weekly": {
      // Map day name to Quartz DOW (1=Sun..7=Sat)
      const dow: Record<string, number> = {
        sun: 1,
        mon: 2,
        tue: 3,
        wed: 4,
        thu: 5,
        fri: 6,
        sat: 7,
      };
      const d = ch.schedule_day ? dow[ch.schedule_day.toLowerCase().slice(0, 3)] : 2;
      return `0 0 ${hour} ? * ${d ?? 2}`;
    }
    case "monthly":
      return `0 0 ${hour} 1 * ?`;
    default:
      return undefined;
  }
}

export function translateChannelsToHandlers(channels: AlertChannel[]): NotificationHandler[] {
  return channels.map((ch) => {
    const channelType = canonicalizeChannelType(ch.channel_type);
    const recipients: NotificationRecipient[] = [];

    if (ch.recipients) {
      for (const r of ch.recipients) {
        recipients.push(userRecipient(r.id));
      }
    }

    // Slack channel name can arrive as legacy details.channel or details.value;
    // accept either and emit the raw-value recipient the v0.59+ API requires.
    const slackChannel =
      typeof ch.details?.channel === "string"
        ? ch.details.channel
        : typeof (ch.details as { value?: string } | undefined)?.value === "string"
          ? (ch.details as { value?: string }).value
          : undefined;
    if (channelType === "channel/slack" && slackChannel) {
      recipients.push(slackChannelRecipient(slackChannel));
    }

    return { channel_type: channelType, recipients };
  });
}

export function translateChannelsToSubscriptions(
  channels: AlertChannel[],
): NotificationSubscription[] {
  const subs: NotificationSubscription[] = [];
  // The new API attaches a single schedule at the notification level. If
  // multiple channels carry conflicting schedules we take the first one
  // found, since that matches how the legacy API behaved (the schedule was
  // notification-wide even when stored per-channel).
  for (const ch of channels) {
    const cron = channelToCron(ch);
    if (cron) {
      subs.push(cronSubscription(cron));
      break;
    }
  }
  return subs;
}

export class AlertApi {
  constructor(private client: MetabaseClient) {}

  async list(): Promise<unknown[]> {
    const notifications = await this.client.get<unknown[]>("/api/notification", {
      payload_type: "notification/card",
    });
    return notifications;
  }

  async get(id: number): Promise<unknown> {
    return this.client.get<unknown>(`/api/notification/${id}`);
  }

  async create(params: CreateAlertParams): Promise<unknown> {
    const subscriptions = translateChannelsToSubscriptions(params.channels);
    const body: NotificationCreateBody = {
      payload_type: "notification/card",
      payload: {
        card_id: params.card.id,
        send_once: params.alert_first_only,
        send_condition: mapSendCondition(params.alert_condition, params.alert_above_goal),
      },
      handlers: translateChannelsToHandlers(params.channels),
      ...(subscriptions.length > 0 ? { subscriptions } : {}),
      active: true,
    };
    return this.client.post<unknown>("/api/notification", body);
  }

  async update(id: number, params: UpdateAlertParams): Promise<unknown> {
    const body: NotificationUpdateBody = {
      payload_type: "notification/card",
    };

    const payload: Partial<NotificationPayload> = {};
    if (params.card) payload.card_id = params.card.id;
    if (params.alert_condition !== undefined || params.alert_above_goal !== undefined) {
      const condition = params.alert_condition ?? "rows";
      payload.send_condition = mapSendCondition(condition, params.alert_above_goal);
    }
    if (params.alert_first_only !== undefined) payload.send_once = params.alert_first_only;
    if (Object.keys(payload).length > 0) body.payload = payload;

    if (params.channels) {
      body.handlers = translateChannelsToHandlers(params.channels);
      const subs = translateChannelsToSubscriptions(params.channels);
      if (subs.length > 0) body.subscriptions = subs;
    }

    return this.client.put<unknown>(`/api/notification/${id}`, body);
  }

  async delete(id: number): Promise<void> {
    await this.client.put(`/api/notification/${id}`, { active: false });
  }
}

import type { MetabaseClient } from "../client.js";

export interface AlertChannel {
  channel_type: string;
  enabled: boolean;
  recipients?: { id: number }[];
  details?: Record<string, unknown>;
  schedule_type?: string;
  schedule_hour?: number;
  schedule_day?: string;
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

interface NotificationHandler {
  channel_type: string;
  recipients?: { type: string; user_id: number }[];
  schedule?: {
    schedule_type?: string;
    schedule_hour?: number;
    schedule_day?: string;
  };
}

interface NotificationPayload {
  card_id: number;
  alert_condition?: "rows" | "goal";
  alert_first_only?: boolean;
  alert_above_goal?: boolean;
}

interface NotificationCreateBody {
  payload_type: "notification/card";
  payload: NotificationPayload;
  handlers: NotificationHandler[];
  active: boolean;
}

interface NotificationUpdateBody {
  payload_type?: "notification/card";
  payload?: Partial<NotificationPayload>;
  handlers?: NotificationHandler[];
  active?: boolean;
}

function translateChannelsToHandlers(channels: AlertChannel[]): NotificationHandler[] {
  return channels.map((ch) => {
    const handler: NotificationHandler = {
      channel_type: ch.channel_type,
    };
    if (ch.recipients) {
      handler.recipients = ch.recipients.map((r) => ({
        type: "notification-recipient/user",
        user_id: r.id,
      }));
    }
    if (ch.schedule_type || ch.schedule_hour !== undefined || ch.schedule_day) {
      handler.schedule = {};
      if (ch.schedule_type) handler.schedule.schedule_type = ch.schedule_type;
      if (ch.schedule_hour !== undefined) handler.schedule.schedule_hour = ch.schedule_hour;
      if (ch.schedule_day) handler.schedule.schedule_day = ch.schedule_day;
    }
    return handler;
  });
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
    const body: NotificationCreateBody = {
      payload_type: "notification/card",
      payload: {
        card_id: params.card.id,
        alert_condition: params.alert_condition,
        alert_first_only: params.alert_first_only,
        alert_above_goal: params.alert_above_goal,
      },
      handlers: translateChannelsToHandlers(params.channels),
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
    if (params.alert_condition !== undefined) payload.alert_condition = params.alert_condition;
    if (params.alert_first_only !== undefined) payload.alert_first_only = params.alert_first_only;
    if (params.alert_above_goal !== undefined) payload.alert_above_goal = params.alert_above_goal;
    if (Object.keys(payload).length > 0) body.payload = payload;

    if (params.channels) {
      body.handlers = translateChannelsToHandlers(params.channels);
    }

    return this.client.put<unknown>(`/api/notification/${id}`, body);
  }

  async delete(id: number): Promise<void> {
    await this.client.put(`/api/notification/${id}`, { active: false });
  }
}

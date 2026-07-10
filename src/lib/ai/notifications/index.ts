// Notifications — infra contracts only (no delivery yet).
export type NotificationChannel = "email" | "whatsapp" | "slack" | "discord" | "webhook" | "push";

export type NotificationSeverity = "info" | "warning" | "critical";

export type NotificationPayload = {
  id: string;
  organizationId: string;
  channel: NotificationChannel;
  severity: NotificationSeverity;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  createdAt: string;
};

export interface NotificationTransport {
  readonly channel: NotificationChannel;
  send(payload: NotificationPayload): Promise<{ delivered: boolean; reason?: string }>;
}

export class NotificationRegistry {
  private transports = new Map<NotificationChannel, NotificationTransport>();
  register(t: NotificationTransport): void { this.transports.set(t.channel, t); }
  get(ch: NotificationChannel): NotificationTransport | undefined { return this.transports.get(ch); }
  channels(): NotificationChannel[] { return [...this.transports.keys()]; }
}

export const notificationRegistry = new NotificationRegistry();

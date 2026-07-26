export const EXCHANGES = {
  EVENTS: 'traveler.events',
  COMMANDS: 'traveler.commands',
} as const;

export const QUEUES = {
  NOTIFICATIONS: 'notification.queue',
  CHAT: 'chat.queue',
  TRIP: 'trip.queue',
} as const;

export const ROUTING_KEYS = {
  USER_CREATED: 'user.created',
  TRIP_CREATED: 'trip.created',
  TRIP_UPDATED: 'trip.updated',
  PAYMENT_COMPLETED: 'payment.completed',
  NOTIFICATION_SEND: 'notification.send',
} as const;

export interface BaseEvent<TPayload = unknown> {
  id: string;
  type: string;
  timestamp: string;
  source: string;
  payload: TPayload;
}

export interface UserCreatedEvent extends BaseEvent<{ userId: string; email: string }> {
  type: 'user.created';
}

export interface TripCreatedEvent extends BaseEvent<{ tripId: string; userId: string }> {
  type: 'trip.created';
}

/**
 * One typed class per work/event record declared under features/{login,task}/event/**, with fields
 * mirroring each record's `payload` exactly. A feature that needs a domain signal from task or login
 * subscribes to these through the PlatformEventBus port instead of importing task/login code directly.
 *
 * event.login.new-device-signin is declared here too, matching its record's payload, even though nothing
 * publishes it yet: the record itself is blockedBy gap.login.device-field (no deviceId exists anywhere
 * in the session/person shape until decision.login.session.devices is settled), so there is no honest
 * producer for it today. See the final report for this and the other events this port cannot yet emit.
 */

export class TaskCreatedEvent {
  readonly kind = 'event.task.created' as const;
  constructor(
    readonly taskId: string,
    readonly ownerId: string,
    readonly createdAt: Date,
    readonly sourceEventId: string,
  ) {}
}

export class TaskCompletedEvent {
  readonly kind = 'event.task.completed' as const;
  constructor(
    readonly taskId: string,
    readonly ownerId: string,
    readonly completedAt: Date,
    readonly sourceEventId: string,
  ) {}
}

export class TaskDeletedEvent {
  readonly kind = 'event.task.deleted' as const;
  constructor(
    readonly taskId: string,
    readonly ownerId: string,
    readonly deletedAt: Date,
    readonly sourceEventId: string,
  ) {}
}

export class SignedInEvent {
  readonly kind = 'event.login.signed-in' as const;
  constructor(
    readonly personId: string,
    readonly signedInAt: Date,
    readonly sourceEventId: string,
  ) {}
}

export class SignedOutEvent {
  readonly kind = 'event.login.signed-out' as const;
  constructor(
    readonly personId: string,
    readonly signedOutAt: Date,
    readonly sourceEventId: string,
  ) {}
}

/**
 * event.login.new-device-signin's declared shape. No use case constructs this today (see the class
 * comment above); it is typed here so a future consumer and the record that unblocks it (once
 * decision.login.session.devices is settled and a real deviceId exists) have a concrete target to code
 * against, and so this port never silently drops a declared event from its vocabulary.
 */
export class NewDeviceSigninEvent {
  readonly kind = 'event.login.new-device-signin' as const;
  constructor(
    readonly personId: string,
    readonly deviceId: string,
    readonly signedInAt: Date,
    readonly sourceEventId: string,
  ) {}
}

export type PlatformEvent =
  | TaskCreatedEvent
  | TaskCompletedEvent
  | TaskDeletedEvent
  | SignedInEvent
  | SignedOutEvent
  | NewDeviceSigninEvent;

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
    readonly kind = "event.task.created" as const
    constructor(
    readonly taskId: string,
    readonly ownerId: string,
    readonly createdAt: Date,
    readonly sourceEventId: string,
    ) {}
}

/** Event published on the platform event bus when task completed happens; the id it carries always comes from the producer. */
export class TaskCompletedEvent {
    readonly kind = "event.task.completed" as const
    constructor(
    readonly taskId: string,
    readonly ownerId: string,
    readonly completedAt: Date,
    readonly sourceEventId: string,
    ) {}
}

/** Event published on the platform event bus when task deleted happens; the id it carries always comes from the producer. */
export class TaskDeletedEvent {
    readonly kind = "event.task.deleted" as const
    constructor(
    readonly taskId: string,
    readonly ownerId: string,
    readonly deletedAt: Date,
    readonly sourceEventId: string,
    ) {}
}

/** Event published on the platform event bus when signed in happens; the id it carries always comes from the producer. */
export class SignedInEvent {
    readonly kind = "event.login.signed-in" as const
    constructor(
    readonly personId: string,
    readonly signedInAt: Date,
    readonly sourceEventId: string,
    ) {}
}

/** Event published on the platform event bus when signed out happens; the id it carries always comes from the producer. */
export class SignedOutEvent {
    readonly kind = "event.login.signed-out" as const
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
    readonly kind = "event.login.new-device-signin" as const
    constructor(
    readonly personId: string,
    readonly deviceId: string,
    readonly signedInAt: Date,
    readonly sourceEventId: string,
    ) {}
}

/**
 * Deliberately not exported: a type alias naming a union of classes has no statically provable object
 * shape to the backend source-naming check (BE_SOURCE_NAME_INVALID's naming coverage), because a class
 * reference resolves to 'unavailable' rather than 'object' or 'not-object'. It stays a same-file type used
 * only inside event-bus.providers.ts's own local union (see that file); nothing outside this pair of
 * files needs to name "any platform event" as a single type - each subscriber narrows by `instanceof` or
 * by the `kind` discriminant on the concrete event it cares about.
 */

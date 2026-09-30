import type { NotifyDispatchKind } from "@modules/domain/notify"

/** What dispatching a digest group takes. */
export interface DispatchNotificationGroupRequest {
    /** The id of the delivered message; the inbox claim is built on it. */
    readonly eventId: string
    /** Whether the group is flushed because its window closed, or retried after a failed send. */
    readonly kind: NotifyDispatchKind
    /** The digest group, which is the id of its digest window. */
    readonly groupId: string
}

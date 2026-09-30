import type { DispatchedGroup, NotifyDispatchKind } from "@modules/domain/notify"

/** What dispatching a digest group takes. */
export interface DispatchNotificationGroupRequest {
    /** Whether the group is flushed because its window closed, or retried after a failed send. */
    readonly kind: NotifyDispatchKind
    /** The digest group, which is the id of its digest window. */
    readonly groupId: string
}

/** How many notifications of the group were delivered, went back to queued for a retry, or bounced; all zero when there was nothing to send. */
export type DispatchNotificationGroupResult = DispatchedGroup

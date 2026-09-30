import type { NotifyDispatchKind } from "@modules/domain/notify"

/** What dispatching a digest group takes. */
export interface DispatchNotificationGroupRequest {
    /** Whether the group is flushed because its window closed, or retried after a failed send. */
    readonly kind: NotifyDispatchKind
    /** The digest group, which is the id of its digest window. */
    readonly groupId: string
}

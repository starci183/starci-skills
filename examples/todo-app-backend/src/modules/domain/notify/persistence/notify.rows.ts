import type {
    DeliveryAttemptView,
    DigestWindowView,
    NotificationView,
    PreferenceView,
} from "../notify.contracts"
import type { NotifyDeliveryAttemptEntity } from "./entities/delivery-attempt.entity"
import type { NotifyDigestWindowEntity } from "./entities/digest-window.entity"
import type { NotifyNotificationEntity } from "./entities/notification.entity"
import type { NotifyPreferenceEntity } from "./entities/preference.entity"

/** Maps a notification row to the view callers get. */
export const toNotificationView = (row: NotifyNotificationEntity): NotificationView => ({
    id: row.id,
    kind: row.kind,
    recipientId: row.recipientId,
    payload: row.payload,
    digestGroupId: row.digestGroupId,
    createdAt: row.createdAt,
})

/** Maps a delivery attempt row to the view callers get. */
export const toDeliveryAttemptView = (row: NotifyDeliveryAttemptEntity): DeliveryAttemptView => ({
    notificationId: row.notificationId,
    state: row.state,
    attempt: row.attempt,
    failureClass: row.failureClass,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    history: row.history,
})

/** Maps a digest window row to the view callers get. */
export const toDigestWindowView = (row: NotifyDigestWindowEntity): DigestWindowView => ({
    id: row.id,
    personId: row.personId,
    channel: row.channel,
    opensAt: row.opensAt,
    closesAt: row.closesAt,
    flushedAt: row.flushedAt,
})

/** Maps a preference row to the view callers get. */
export const toPreferenceView = (row: NotifyPreferenceEntity): PreferenceView => ({
    personId: row.personId,
    channel: row.channel,
    unsubscribed: row.unsubscribed,
    digestWindowMinutes: row.digestWindowMinutes,
})

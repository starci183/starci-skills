import { NotifyNotificationEntity } from "./persistence/entities/notification.entity"
import { NotifyDeliveryAttemptEntity } from "./persistence/entities/delivery-attempt.entity"
import { NotifyDigestWindowEntity } from "./persistence/entities/digest-window.entity"
import { NotifyPreferenceEntity } from "./persistence/entities/preference.entity"
import { CreateNotifyTables1758210000000 } from "./persistence/migrations/1758210000000-create-notify-tables"

/** The entities of the notify capability, for the connection that holds them. */
export const notifyEntities = [
    NotifyNotificationEntity,
    NotifyDeliveryAttemptEntity,
    NotifyDigestWindowEntity,
    NotifyPreferenceEntity,
]

/** The migrations of the notify capability, in the order they run. */
export const notifyMigrations = [CreateNotifyTables1758210000000]

export { NOTIFY_ERROR_KINDS, NotifyError, NotifyErrorCode } from "./errors/notify.error"
export { NOTIFY_MESSAGES } from "./messages/notify.messages"
export { NOTIFY_CHANNEL_EMAIL, NOTIFY_KIND_TASK_COMPLETE } from "./notify.contracts"
export type {
    AdmittedNotification,
    DispatchedGroup,
    NotifyAdmitPayload,
    NotifyDispatchKind,
    NotifyDispatchPayload,
    NotifyPayload,
} from "./notify.contracts"
export {
    NOTIFY_ADMIT_QUEUE,
    NOTIFY_DISPATCH_QUEUE,
    toNotifyAdmitMessage,
    toNotifyDispatchMessage,
} from "./notify.mapper"
export { NotifyModule } from "./notify.module"
export { NotifyService } from "./notify.service"
export { PreferencesService } from "./preferences.service"

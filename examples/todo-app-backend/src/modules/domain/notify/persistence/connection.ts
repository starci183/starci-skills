import { PRIMARY_CONNECTION } from "@modules/platform/database"
import { NotifyNotificationEntity } from "./entities/notification.entity"
import { NotifyDeliveryAttemptEntity } from "./entities/delivery-attempt.entity"
import { NotifyDigestWindowEntity } from "./entities/digest-window.entity"
import { NotifyPreferenceEntity } from "./entities/preference.entity"
import { CreateNotifyTables1758210000000 } from "./migrations/1758210000000-create-notify-tables"

/** The connection that holds the tables of the notify capability. */
export const CONNECTION = PRIMARY_CONNECTION

/** The entities of the notify capability, for the connection that holds them. */
export const notifyEntities = [
    NotifyNotificationEntity,
    NotifyDeliveryAttemptEntity,
    NotifyDigestWindowEntity,
    NotifyPreferenceEntity,
]

/** The migrations of the notify capability, in the order they run. */
export const notifyMigrations = [CreateNotifyTables1758210000000]

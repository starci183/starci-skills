import { Injectable } from "@nestjs/common"
import { InjectPrimaryEntityManager, LIST_ROWS_MAX } from "@modules/platform/database"
import { IsNull } from "typeorm"
import type { EntityManager } from "typeorm"
import type {
    AssignDigestGroupParams,
    DedupeAdmitParams,
    DedupeAdmitResult,
    FindDigestGroupParams,
    NotificationView,
} from "./notify.contracts"
import { computeDedupeKey } from "./notify.policy"
import { NotifyNotificationEntity } from "./persistence/entities/notification.entity"
import { INSERT_NOTIFICATION_IF_ABSENT } from "./persistence/notify.sql"
import { toNotificationView } from "./persistence/notify.rows"

@Injectable()
/**
 * The notification table and its dedupe rule: the id of a notification is the sha256 of its kind, its source event id
 * and its recipient, so admitting the same event twice reads back the first row and writes nothing.
 */
export class DedupeService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Admits the notification once; a repeated admission answers the stored row with isNew false. */
    async admit(params: DedupeAdmitParams): Promise<DedupeAdmitResult> {
        const id = computeDedupeKey(params.kind, params.sourceEventId, params.recipientId)
        // An INSERT answers the rows it inserted: none when the key was already admitted.
        const inserted: Array<{ id: string }> = await params.manager.query(INSERT_NOTIFICATION_IF_ABSENT, [
            id,
            params.kind,
            params.recipientId,
            JSON.stringify(params.payload),
            params.at,
        ])
        const fresh: NotificationView = {
            id,
            kind: params.kind,
            recipientId: params.recipientId,
            payload: params.payload,
            digestGroupId: null,
            createdAt: params.at,
        }
        if (inserted.length > 0) return { notification: fresh, isNew: true }
        const existing = await params.manager.findOneBy(NotifyNotificationEntity, { id })
        return { notification: existing ? toNotificationView(existing) : fresh, isNew: false }
    }

    /** The notifications of one digest group in admission order, at most LIST_ROWS_MAX. */
    async findByDigestGroup(params: FindDigestGroupParams): Promise<Array<NotificationView>> {
        const rows = await this.entityManager.find(NotifyNotificationEntity, {
            where: { digestGroupId: params.groupId },
            order: { createdAt: "ASC" },
            take: LIST_ROWS_MAX,
        })
        return rows.map(toNotificationView)
    }

    /** Assigns the notification to its digest group; a notification that already has one keeps it. */
    async assignDigestGroup(params: AssignDigestGroupParams): Promise<void> {
        await params.manager.update(
            NotifyNotificationEntity,
            { id: params.id, digestGroupId: IsNull() },
            { digestGroupId: params.digestGroupId },
        )
    }
}

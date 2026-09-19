import {
    Injectable 
} from "@nestjs/common"
import {
    createHash 
} from "node:crypto"
import type {
    EntityManager 
} from "typeorm"
import {
    InjectPrimaryEntityManager 
} from "@modules/platform/databases/postgresql/primary/primary.decorators"
import {
    NotifyNotificationEntity 
} from "@modules/platform/databases/postgresql/primary/entities/notification.entity"
import {
    NotificationRecord 
} from "./types/notification-record"

/** Contract naming the admit notification params shape bussiness/notify code and its consumers share; a second site never retypes it inline. */
export interface AdmitNotificationParams {
  readonly kind: string;
  readonly sourceEventId: string;
  readonly recipientId: string;
  readonly payload: Record<string, unknown>;
}

/** Contract naming the admit notification result shape bussiness/notify code and its consumers share; a second site never retypes it inline. */
export interface AdmitNotificationResult {
  readonly record: NotificationRecord;
  /** True only when this call actually inserted a new row; false when an earlier admission for the same
   * dedupe key already exists and this call returned that same row instead of creating a second one. */
  readonly isNew: boolean;
}

/**
 * br.notify.delivery.once / decision.notify.dedupe-key: the dedupe key is sha256 of kind + sourceEventId +
 * recipientId - never the payload (decision.notify.dedupe-key's payload-hash option was refused: two
 * distinct real events with the same payload must not collapse into one). The notification's id equals
 * its dedupeKey (data.notify.notification), so admitting the same triple twice reads back the same row by
 * primary key - there is no read-then-write race to reason about beyond what a unique primary key already
 * gives a duplicate insert.
 */
@Injectable()
/** Injectable service owning the dedupe logic the notify capability exposes; wired by the capability's own module. */
export class DedupeService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    async admit(params: AdmitNotificationParams): Promise<AdmitNotificationResult> {
        const dedupeKey = computeDedupeKey(params.kind,
            params.sourceEventId,
            params.recipientId)
        const existing = await this.entityManager.findOneBy(NotifyNotificationEntity,
            {
                id: dedupeKey 
            })
        if (existing) {
            return {
                record: toRecord(existing), isNew: false 
            }
        }
        const saved = await this.entityManager.save(NotifyNotificationEntity,
            {
                id: dedupeKey,
                kind: params.kind,
                recipientId: params.recipientId,
                payload: params.payload,
                digestGroupId: null,
                createdAt: new Date(),
            })
        return {
            record: toRecord(saved), isNew: true 
        }
    }

    async findById(id: string): Promise<NotificationRecord | null> {
        const row = await this.entityManager.findOneBy(NotifyNotificationEntity,
            {
                id 
            })
        return row ? toRecord(row) : null
    }

    /** Every notification currently assigned to `digestGroupId`, in admission order - the order
   * fr.notify.digest's flush must read the group's content in (ac.notify.digest.window.collapses-into-one-message:
   * "in admission order"). */
    async findByDigestGroup(digestGroupId: string): Promise<Array<NotificationRecord>> {
        const rows = await this.entityManager.findBy(NotifyNotificationEntity,
            {
                digestGroupId 
            })
        return rows.map(toRecord).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    }

    async assignDigestGroup(id: string, digestGroupId: string): Promise<void> {
        const row = await this.entityManager.findOneBy(NotifyNotificationEntity,
            {
                id 
            })
        if (!row || row.digestGroupId) {
            // Already assigned: data.notify.notification's invariant is "set exactly once", so a second call
            // (a retried admission) is a no-op rather than an overwrite.
            return
        }
        row.digestGroupId = digestGroupId
        await this.entityManager.save(NotifyNotificationEntity,
            row)
    }
}

/** Compute dedupe key for the dedupe.service flow - one named step of the notify capability's behaviour. */
export function computeDedupeKey(kind: string, sourceEventId: string, recipientId: string): string {
    return createHash("sha256").update(`${kind}:${sourceEventId}:${recipientId}`).digest("hex")
}

function toRecord(row: NotifyNotificationEntity): NotificationRecord {
    return new NotificationRecord(row.id,
        row.kind,
        row.recipientId,
        row.payload,
        row.digestGroupId,
        row.createdAt)
}

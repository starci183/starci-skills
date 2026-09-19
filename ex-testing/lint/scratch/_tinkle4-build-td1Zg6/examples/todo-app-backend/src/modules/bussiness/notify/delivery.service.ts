import {
    Injectable 
} from "@nestjs/common"
import type {
    EntityManager 
} from "typeorm"
import {
    InjectPrimaryEntityManager 
} from "@modules/platform/databases/postgresql/primary/primary.decorators"
import {
    NotifyDeliveryAttemptEntity 
} from "@modules/platform/databases/postgresql/primary/entities/notify-delivery-attempt.entity"
import {
    NotifySmtpMessage, NotifySmtpPort 
} from "@modules/integrations/notify-smtp/notify-smtp.contracts"
import {
    NotifySmtpPermanentRejectionException 
} from "@modules/shared/exceptions/errors/notify/notify-smtp-permanent-rejection"
import {
    NotifySmtpTransientFailureException 
} from "@modules/shared/exceptions/errors/notify/notify-smtp-transient-failure"

import {
    DeliveryAttemptRecord, DeliveryHistoryEntry 
} from "./types/delivery-attempt-record"

/** br.notify.failure.classified's "bounded number of attempts": a transient failure retries up to this
 * many dispatch attempts before it is recorded as retries-exhausted rather than retried forever. */
export const RETRY_BUDGET = 3

/** Contract naming the dispatch batch result shape bussiness/notify code and its consumers share; a second site never retypes it inline. */
export interface DispatchBatchResult {
  readonly delivered: Array<string>;
  readonly retried: Array<string>;
  readonly bounced: Array<string>;
}

/**
 * sds.notify.delivery-lifecycle: carries one delivery attempt from admission to a terminal outcome. The
 * pipeline (notify.service.ts) is the only caller - nothing else reads or writes
 * NotifyDeliveryAttemptEntity. Method names mirror the record's transition ids (t-suppress, t-dispatch,
 * t-deliver, t-bounce, t-retry, t-give-up) so the record and the code read together, the same convention
 * `TaskService`'s tComplete/tReopen and `SessionService`'s tBegin/tAccept already use in this codebase.
 */
@Injectable()
/** Injectable service owning the delivery logic the notify capability exposes; wired by the capability's own module. */
export class DeliveryService {
    constructor(
    @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
    private readonly smtp: NotifySmtpPort,
    ) {}

    /** The delivery attempt's initial state (implicit `queued` in the state machine), immediately followed
   * by t-suppress when the recipient is already unsubscribed - br.notify.failure.classified's
   * suppresses-unsubscribed acceptance criterion: suppressed is reached before any dispatch attempt, and
   * no attempt is ever made against the transport. */
    async admit(notificationId: string, now: Date, unsubscribed: boolean): Promise<DeliveryAttemptRecord> {
        const history: Array<DeliveryHistoryEntry> = [{
            state: "queued", at: now.toISOString() 
        }]
        if (unsubscribed) {
            history.push({
                state: "suppressed", at: now.toISOString(), failureClass: "unsubscribed" 
            })
            const saved = await this.entityManager.save(NotifyDeliveryAttemptEntity,
                {
                    notificationId,
                    state: "suppressed",
                    attempt: 0,
                    failureClass: "unsubscribed",
                    startedAt: null,
                    endedAt: now,
                    history,
                })
            return toRecord(saved)
        }
        const saved = await this.entityManager.save(NotifyDeliveryAttemptEntity,
            {
                notificationId,
                state: "queued",
                attempt: 0,
                failureClass: null,
                startedAt: null,
                endedAt: null,
                history,
            })
        return toRecord(saved)
    }

    async findById(notificationId: string): Promise<DeliveryAttemptRecord | null> {
        const row = await this.entityManager.findOneBy(NotifyDeliveryAttemptEntity,
            {
                notificationId 
            })
        return row ? toRecord(row) : null
    }

    /**
   * t-dispatch for every queued attempt in the batch, one SMTP `send` covering all of them (br.notify.digest.window:
   * a flushed group is rendered as one message), then t-deliver/t-bounce/t-retry/t-give-up applied to
   * each attempt from that single outcome. Attempts not currently `queued` are skipped rather than
   * failed, so a batch that included an already-suppressed member is a no-op for that member.
   */
    async dispatchBatch(notificationIds: Array<string>, now: Date, message: NotifySmtpMessage): Promise<DispatchBatchResult> {
        const rows: Array<NotifyDeliveryAttemptEntity> = []
        for (const notificationId of notificationIds) {
            const row = await this.entityManager.findOneBy(NotifyDeliveryAttemptEntity,
                {
                    notificationId 
                })
            if (row && row.state === "queued") rows.push(row)
        }
        if (rows.length === 0) {
            return {
                delivered: [], retried: [], bounced: [] 
            }
        }

        for (const row of rows) {
            row.state = "sending"
            row.attempt += 1
            row.startedAt = row.startedAt ?? now
            row.history = [...row.history,
                {
                    state: "sending", at: now.toISOString() 
                }]
            await this.entityManager.save(NotifyDeliveryAttemptEntity,
                row)
        }

        try {
            await this.smtp.send(message)
            for (const row of rows) {
                row.state = "delivered"
                row.endedAt = now
                row.history = [...row.history,
                    {
                        state: "delivered", at: now.toISOString() 
                    }]
                await this.entityManager.save(NotifyDeliveryAttemptEntity,
                    row)
            }
            return {
                delivered: rows.map(row => row.notificationId), retried: [], bounced: [] 
            }
        } catch (error) {
            if (error instanceof NotifySmtpPermanentRejectionException) {
                for (const row of rows) {
                    row.state = "bounced"
                    row.failureClass = "permanent-bounce"
                    row.endedAt = now
                    row.history = [...row.history,
                        {
                            state: "bounced", at: now.toISOString(), failureClass: "permanent-bounce" 
                        }]
                    await this.entityManager.save(NotifyDeliveryAttemptEntity,
                        row)
                }
                return {
                    delivered: [], retried: [], bounced: rows.map(row => row.notificationId) 
                }
            }
            if (error instanceof NotifySmtpTransientFailureException) {
                const retried: Array<string> = []
                const bounced: Array<string> = []
                for (const row of rows) {
                    if (row.attempt < RETRY_BUDGET) {
                        row.state = "queued"
                        row.failureClass = "transient"
                        row.history = [...row.history,
                            {
                                state: "queued", at: now.toISOString(), failureClass: "transient" 
                            }]
                        retried.push(row.notificationId)
                    } else {
                        row.state = "bounced"
                        row.failureClass = "retries-exhausted"
                        row.endedAt = now
                        row.history = [...row.history,
                            {
                                state: "bounced", at: now.toISOString(), failureClass: "retries-exhausted" 
                            }]
                        bounced.push(row.notificationId)
                    }
                    await this.entityManager.save(NotifyDeliveryAttemptEntity,
                        row)
                }
                return {
                    delivered: [], retried, bounced 
                }
            }
            throw error
        }
    }
}

function toRecord(row: NotifyDeliveryAttemptEntity): DeliveryAttemptRecord {
    // The entity's `history` column is typed loosely (plain `string` fields) since the platform database
    // module never depends on a capability's own types; every element this service ever writes is
    // actually a DeliveryHistoryEntry, so the cast is honest rather than a widening escape.
    return new DeliveryAttemptRecord(
        row.notificationId,
        row.state,
        row.attempt,
        row.failureClass,
        row.startedAt,
        row.endedAt,
    row.history as Array<DeliveryHistoryEntry>,
    )
}

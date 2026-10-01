import { Injectable } from "@nestjs/common"
import { InjectNotifySmtp, NotifySmtpError, NotifySmtpErrorCode } from "@modules/integrations/notify-smtp"
import type { NotifySmtpClient, NotifySmtpMessageParams } from "@modules/integrations/notify-smtp"
import { InjectPrimaryEntityManager, LIST_ROWS_MAX } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { In } from "typeorm"
import type { EntityManager } from "typeorm"
import { NotifyLogEvent } from "./notify.log-events"
import type {
    AdmitDeliveryParams,
    DeliveryAttemptView,
    DeliveryHistoryEntry,
    DeliveryVerdict,
    FindDeliveryParams,
    MarkSendingParams,
    RecordDeliveryParams,
    RecordedDelivery,
} from "./notify.contracts"
import { settleAttempt } from "./notify.policy"
import { NotifyDeliveryAttemptEntity } from "./persistence/entities/delivery-attempt.entity"
import { toDeliveryAttemptView } from "./persistence/notify.rows"

@Injectable()
/**
 * The delivery attempts and the one send to the mail host. An attempt goes queued, sending, then delivered, bounced or
 * back to queued for a retry; an unsubscribed recipient's attempt is created suppressed and is never sent. The send
 * itself holds no transaction: the caller marks the attempts sending, sends, then records the outcome.
 */
export class DeliveryService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectNotifySmtp() private readonly smtp: NotifySmtpClient,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** Creates the attempt of a notification: queued, or suppressed at once when the recipient opted out. */
    async admit(params: AdmitDeliveryParams): Promise<DeliveryAttemptView> {
        const queued: DeliveryHistoryEntry = { state: "queued", at: params.at.toISOString() }
        if (params.unsubscribed) {
            const saved = await params.manager.save(NotifyDeliveryAttemptEntity, {
                notificationId: params.notificationId,
                state: "suppressed",
                attempt: 0,
                failureClass: "unsubscribed",
                startedAt: null,
                endedAt: params.at,
                history: [queued, { state: "suppressed", at: params.at.toISOString(), failureClass: "unsubscribed" }],
            })
            return toDeliveryAttemptView(saved)
        }
        const saved = await params.manager.save(NotifyDeliveryAttemptEntity, {
            notificationId: params.notificationId,
            state: "queued",
            attempt: 0,
            failureClass: null,
            startedAt: null,
            endedAt: null,
            history: [queued],
        })
        return toDeliveryAttemptView(saved)
    }

    /** The attempt of a notification, or null. */
    async find(params: FindDeliveryParams): Promise<DeliveryAttemptView | null> {
        const row = await this.entityManager.findOneBy(NotifyDeliveryAttemptEntity, {
            notificationId: params.notificationId,
        })
        return row ? toDeliveryAttemptView(row) : null
    }

    /** Moves every queued attempt of the batch to sending and counts the dispatch; attempts in any other state are left alone. */
    async markSending(params: MarkSendingParams): Promise<Array<DeliveryAttemptView>> {
        if (params.notificationIds.length === 0) return []
        const found = await params.manager.find(NotifyDeliveryAttemptEntity, {
            where: { notificationId: In([...params.notificationIds]) },
            take: LIST_ROWS_MAX,
        })
        const sending = found
            .filter((row) => row.state === "queued")
            .map((row) => ({
                ...row,
                state: "sending" as const,
                attempt: row.attempt + 1,
                startedAt: row.startedAt ?? params.at,
                history: [...row.history, { state: "sending" as const, at: params.at.toISOString() }],
            }))
        if (sending.length === 0) return []
        const saved = await params.manager.save(NotifyDeliveryAttemptEntity, sending)
        return saved.map(toDeliveryAttemptView)
    }

    /** Sends one message. It holds no transaction and never throws for a mail-host failure: the answer is the verdict. */
    async transmit(message: NotifySmtpMessageParams): Promise<DeliveryVerdict> {
        try {
            await this.smtp.send(message)
            return "delivered"
        } catch (error) {
            if (error instanceof NotifySmtpError && error.code === NotifySmtpErrorCode.PermanentRejection) {
                this.logger.warn(NotifyLogEvent.SendRejected, { reason: error.params.reason ?? "" })
                return "permanent-bounce"
            }
            if (error instanceof NotifySmtpError) {
                this.logger.warn(NotifyLogEvent.SendFailed, { reason: error.params.reason ?? "" })
            } else {
                this.logger.error(NotifyLogEvent.SendFailed, error)
            }
            return "transient"
        }
    }

    /** Applies the outcome of one send to every attempt that is still sending: delivered, bounced, or back to queued while the budget lasts. */
    async record(params: RecordDeliveryParams): Promise<RecordedDelivery> {
        if (params.notificationIds.length === 0) return { delivered: [], retried: [], bounced: [], attempt: 0 }
        const found = await params.manager.find(NotifyDeliveryAttemptEntity, {
            where: { notificationId: In([...params.notificationIds]) },
            take: LIST_ROWS_MAX,
        })
        const delivered: Array<string> = []
        const retried: Array<string> = []
        const bounced: Array<string> = []
        let attempt = 0
        const settled = found
            .filter((row) => row.state === "sending")
            .map((row) => {
                const settlement = settleAttempt(params.verdict, row.attempt)
                attempt = Math.max(attempt, row.attempt)
                if (settlement.state === "delivered") delivered.push(row.notificationId)
                else if (settlement.state === "queued") retried.push(row.notificationId)
                else bounced.push(row.notificationId)
                return {
                    ...row,
                    state: settlement.state,
                    failureClass: settlement.failureClass ?? row.failureClass,
                    endedAt: settlement.ends ? params.at : row.endedAt,
                    history: [
                        ...row.history,
                        {
                            state: settlement.state,
                            at: params.at.toISOString(),
                            ...(settlement.failureClass ? { failureClass: settlement.failureClass } : {}),
                        },
                    ],
                }
            })
        if (settled.length > 0) await params.manager.save(NotifyDeliveryAttemptEntity, settled)
        return { delivered, retried, bounced, attempt }
    }
}

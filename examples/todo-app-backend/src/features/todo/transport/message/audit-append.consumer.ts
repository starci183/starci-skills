import { Injectable } from "@nestjs/common"
import type { CommandBus } from "@nestjs/cqrs"
import { AUDIT_APPEND_QUEUE } from "@modules/domain/audit"
import type { AuditAppendPayload } from "@modules/domain/audit"
import { InjectCommandBus } from "@modules/platform/cqrs"
import { InjectInbox } from "@modules/platform/inbox"
import type { Inbox } from "@modules/platform/inbox"
import type { ConsumedMessage, MessageConsumer } from "@modules/platform/messaging"
import { AppendLogLineCommand } from "../../application/append-log-line.command"

/** The inbox source of this consumer: one claim per event id. */
const SOURCE = "audit.append"

@Injectable()
/**
 * Receives the audit lines producers queued in their own transactions and appends each to the log. It claims the event
 * first, so a redelivery of a line that was already written does nothing; when the append fails the claim is given
 * back and the failure is rethrown, so the queue redelivers and the line is not lost.
 */
export class AuditAppendConsumer implements MessageConsumer<AuditAppendPayload> {
    /** The queue this consumer reads. */
    readonly queue = AUDIT_APPEND_QUEUE

    constructor(
        @InjectInbox() private readonly inbox: Inbox,
        @InjectCommandBus() private readonly commandBus: CommandBus,
    ) {}

    /** Appends the line of one delivery. */
    async handle(message: ConsumedMessage<AuditAppendPayload>): Promise<void> {
        if (!(await this.inbox.claim(SOURCE, message.eventId))) return
        try {
            await this.commandBus.execute(
                new AppendLogLineCommand({
                    request: {
                        actorId: message.payload.actorId,
                        action: message.payload.action,
                        target: message.payload.target,
                        at: new Date(message.payload.at),
                    },
                }),
            )
        } catch (error) {
            await this.inbox.release(SOURCE, message.eventId)
            throw error
        }
    }
}

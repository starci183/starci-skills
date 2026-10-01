import { Injectable } from "@nestjs/common"
import type { CommandBus } from "@nestjs/cqrs"
import { AUDIT_APPEND_QUEUE } from "@modules/domain/audit"
import type { AuditAppendPayload } from "@modules/domain/audit"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { ConsumedMessage, MessageConsumer } from "@modules/platform/messaging"
import { AppendLogLineCommand } from "../../application/append-log-line.command"

@Injectable()
/** Receives the audit lines producers queued in their own transactions and appends each to the log through one command. */
export class AuditAppendConsumer implements MessageConsumer<AuditAppendPayload> {
    /** The queue this consumer reads. */
    readonly queue = AUDIT_APPEND_QUEUE

    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Appends the line of one delivery. */
    async handle(message: ConsumedMessage<AuditAppendPayload>): Promise<void> {
        const { eventId, payload } = message
        await this.commandBus.execute(
            new AppendLogLineCommand({
                request: {
                    eventId,
                    actorId: payload.actorId,
                    action: payload.action,
                    target: payload.target,
                    at: new Date(payload.at),
                },
            }),
        )
    }
}

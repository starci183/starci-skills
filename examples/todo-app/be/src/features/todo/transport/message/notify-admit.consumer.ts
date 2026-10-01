import { Injectable } from "@nestjs/common"
import type { CommandBus } from "@nestjs/cqrs"
import { NOTIFY_ADMIT_QUEUE } from "@modules/domain/notify"
import type { NotifyAdmitPayload } from "@modules/domain/notify"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { ConsumedMessage, MessageConsumer } from "@modules/platform/messaging"
import { AdmitNotificationCommand } from "../../application/admit-notification.command"

@Injectable()
/** Consumer of the admit queue: hands each event that may notify someone to the admit command. */
export class NotifyAdmitConsumer implements MessageConsumer<NotifyAdmitPayload> {
    readonly queue = NOTIFY_ADMIT_QUEUE

    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Dispatches one admit command with the message id as the source event id. */
    async handle(message: ConsumedMessage<NotifyAdmitPayload>): Promise<void> {
        await this.commandBus.execute(
            new AdmitNotificationCommand({
                request: {
                    sourceEventId: message.eventId,
                    kind: message.payload.kind,
                    recipientId: message.payload.recipientId,
                    channel: message.payload.channel,
                    payload: message.payload.payload,
                },
            }),
        )
    }
}

import { Injectable } from "@nestjs/common"
import type { CommandBus } from "@nestjs/cqrs"
import { NOTIFY_DISPATCH_QUEUE } from "@modules/domain/notify"
import type { NotifyDispatchPayload } from "@modules/domain/notify"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { ConsumedMessage, MessageConsumer } from "@modules/platform/messaging"
import { DispatchNotificationGroupCommand } from "../../application/dispatch-notification-group.command"

@Injectable()
/** Consumer of the dispatch queue: sends a digest group when its window closes and again after a failed send. */
export class NotifyDispatchConsumer implements MessageConsumer<NotifyDispatchPayload> {
    readonly queue = NOTIFY_DISPATCH_QUEUE

    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Dispatches one dispatch command with the message id, the kind and the group. */
    async handle(message: ConsumedMessage<NotifyDispatchPayload>): Promise<void> {
        await this.commandBus.execute(
            new DispatchNotificationGroupCommand({
                request: { eventId: message.eventId, kind: message.payload.kind, groupId: message.payload.groupId },
            }),
        )
    }
}

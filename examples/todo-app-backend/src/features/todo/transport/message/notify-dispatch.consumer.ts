import { Injectable } from "@nestjs/common"
import type { CommandBus } from "@nestjs/cqrs"
import { NOTIFY_DISPATCH_QUEUE } from "@modules/domain/notify"
import type { NotifyDispatchPayload } from "@modules/domain/notify"
import { InjectCommandBus } from "@modules/platform/cqrs"
import { InjectInbox } from "@modules/platform/inbox"
import type { Inbox } from "@modules/platform/inbox"
import type { ConsumedMessage, MessageConsumer } from "@modules/platform/messaging"
import { DispatchNotificationGroupCommand } from "../../application/dispatch-notification-group.command"

/** The inbox source of this consumer: the claim is per (source, event id). */
const SOURCE = "notify.dispatch"

@Injectable()
/** Consumer of the dispatch queue: sends a digest group when its window closes and again after a failed send, once per message. */
export class NotifyDispatchConsumer implements MessageConsumer<NotifyDispatchPayload> {
    readonly queue = NOTIFY_DISPATCH_QUEUE

    constructor(
        @InjectInbox() private readonly inbox: Inbox,
        @InjectCommandBus() private readonly commandBus: CommandBus,
    ) {}

    /** Claims the message, dispatches one dispatch command, and gives the claim back when the dispatch fails so the redelivery runs. */
    async handle(message: ConsumedMessage<NotifyDispatchPayload>): Promise<void> {
        if (!(await this.inbox.claim(SOURCE, message.eventId))) return
        try {
            await this.commandBus.execute(
                new DispatchNotificationGroupCommand({
                    request: { kind: message.payload.kind, groupId: message.payload.groupId },
                }),
            )
        } catch (error) {
            await this.inbox.release(SOURCE, message.eventId)
            throw error
        }
    }
}

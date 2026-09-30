import { Injectable } from "@nestjs/common"
import type { CommandBus } from "@nestjs/cqrs"
import { NOTIFY_ADMIT_QUEUE } from "@modules/domain/notify"
import type { NotifyAdmitPayload } from "@modules/domain/notify"
import { InjectCommandBus } from "@modules/platform/cqrs"
import { InjectInbox } from "@modules/platform/inbox"
import type { Inbox } from "@modules/platform/inbox"
import type { ConsumedMessage, MessageConsumer } from "@modules/platform/messaging"
import { AdmitNotificationCommand } from "../../application/admit-notification.command"

/** The inbox source of this consumer: the claim is per (source, event id). */
const SOURCE = "notify.admit"

@Injectable()
/** Consumer of the admit queue: hands each event that may notify someone to the admit command, once. */
export class NotifyAdmitConsumer implements MessageConsumer<NotifyAdmitPayload> {
    readonly queue = NOTIFY_ADMIT_QUEUE

    constructor(
        @InjectInbox() private readonly inbox: Inbox,
        @InjectCommandBus() private readonly commandBus: CommandBus,
    ) {}

    /** Claims the event, dispatches one admit command, and gives the claim back when the dispatch fails so the redelivery runs. */
    async handle(message: ConsumedMessage<NotifyAdmitPayload>): Promise<void> {
        if (!(await this.inbox.claim(SOURCE, message.eventId))) return
        try {
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
        } catch (error) {
            await this.inbox.release(SOURCE, message.eventId)
            throw error
        }
    }
}

import { CommandHandler } from "@nestjs/cqrs"
import { NotifyService } from "@modules/domain/notify"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AdmitNotificationCommand } from "./admit-notification.command"
import type { AdmitNotificationResult } from "./admit-notification.contracts"

@CommandHandler(AdmitNotificationCommand)
/** Admits one delivered admit message: the notify service claims it once and admits the event in a single transaction. */
export class AdmitNotificationHandler extends ICQRSHandler<AdmitNotificationCommand, AdmitNotificationResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly notify: NotifyService,
    ) {
        super(logger)
    }

    protected override async process(command: AdmitNotificationCommand): Promise<AdmitNotificationResult> {
        const { request } = command.params
        return this.notify.admitOnce({
            eventId: request.sourceEventId,
            kind: request.kind,
            recipientId: request.recipientId,
            channel: request.channel,
            payload: request.payload,
        })
    }
}

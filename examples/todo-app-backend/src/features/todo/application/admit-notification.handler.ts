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
        return this.notify.admitOnce({
            eventId: command.params.request.sourceEventId,
            kind: command.params.request.kind,
            recipientId: command.params.request.recipientId,
            channel: command.params.request.channel,
            payload: command.params.request.payload,
        })
    }
}

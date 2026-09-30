import { CommandHandler } from "@nestjs/cqrs"
import { NotifyService } from "@modules/domain/notify"
import type { DispatchNotificationGroupResult } from "@modules/domain/notify"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { DispatchNotificationGroupCommand } from "./dispatch-notification-group.command"

@CommandHandler(DispatchNotificationGroupCommand)
/** Sends one delivered dispatch message: the notify service claims it once and sends the digest group as one message. */
export class DispatchNotificationGroupHandler extends ICQRSHandler<
    DispatchNotificationGroupCommand,
    DispatchNotificationGroupResult
> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly notify: NotifyService,
    ) {
        super(logger)
    }

    protected override async process(command: DispatchNotificationGroupCommand): Promise<DispatchNotificationGroupResult> {
        const { eventId, kind, groupId } = command.params.request
        return this.notify.dispatchOnce({ eventId, kind, groupId })
    }
}

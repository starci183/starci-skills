import { CommandHandler } from "@nestjs/cqrs"
import { NotifyService } from "@modules/domain/notify"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { EntityManager } from "typeorm"
import { DispatchNotificationGroupCommand } from "./dispatch-notification-group.command"
import type { DispatchNotificationGroupResult } from "./dispatch-notification-group.contracts"

@CommandHandler(DispatchNotificationGroupCommand)
/**
 * Sends one digest group as one message in three steps so no transaction is open across the mail host: the first
 * transaction closes the window (for a flush) and marks the queued attempts sending, the send runs outside any
 * transaction, and the second transaction records the outcome and writes the retry message when some attempts go
 * back to queued.
 */
export class DispatchNotificationGroupHandler extends ICQRSHandler<
    DispatchNotificationGroupCommand,
    DispatchNotificationGroupResult
> {
    constructor(
        @InjectLogger() logger: Logger,
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        private readonly notify: NotifyService,
    ) {
        super(logger)
    }

    protected override async process(command: DispatchNotificationGroupCommand): Promise<DispatchNotificationGroupResult> {
        const { kind, groupId } = command.params.request
        const at = this.clock.now()
        const plan = await this.entityManager.transaction((manager) =>
            this.notify.prepareDispatch({ manager, kind, groupId, at }),
        )
        if (plan === null) return { delivered: 0, retried: 0, bounced: 0 }
        const verdict = await this.notify.transmit(plan)
        return this.entityManager.transaction((manager) => this.notify.settle({ manager, plan, verdict, at }))
    }
}

import { CommandHandler } from "@nestjs/cqrs"
import { NotifyService } from "@modules/domain/notify"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { EntityManager } from "typeorm"
import { AdmitNotificationCommand } from "./admit-notification.command"
import type { AdmitNotificationResult } from "./admit-notification.contracts"

@CommandHandler(AdmitNotificationCommand)
/**
 * Admits one event in a single transaction: the dedupe row, the delivery attempt, the window membership and, when a
 * window opens, the outbox message that flushes it when it closes. Admitting the same event again writes nothing.
 */
export class AdmitNotificationHandler extends ICQRSHandler<AdmitNotificationCommand, AdmitNotificationResult> {
    constructor(
        @InjectLogger() logger: Logger,
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        private readonly notify: NotifyService,
    ) {
        super(logger)
    }

    protected override async process(command: AdmitNotificationCommand): Promise<AdmitNotificationResult> {
        const { request } = command.params
        const at = this.clock.now()
        return this.entityManager.transaction((manager) =>
            this.notify.admit({
                manager,
                kind: request.kind,
                sourceEventId: request.sourceEventId,
                recipientId: request.recipientId,
                channel: request.channel,
                payload: request.payload,
                at,
            }),
        )
    }
}

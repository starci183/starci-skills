import { CommandHandler } from "@nestjs/cqrs"
import { SettlementService } from "@modules/domain/plan"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { EntityManager } from "typeorm"
import { ConfirmPaymentCommand } from "./confirm-payment.command"
import type { ConfirmPaymentResult } from "./confirm-payment.contracts"

@CommandHandler(ConfirmPaymentCommand)
/**
 * Applies what the gateway reported for one payment intent through the idempotent ledger, in one transaction. A replay,
 * or a failure that arrives after the payment was applied, changes nothing and answers `applied: false`; an unknown
 * intent is refused rather than ignored, so a stray or forged reference is visible.
 */
export class ConfirmPaymentHandler extends ICQRSHandler<ConfirmPaymentCommand, ConfirmPaymentResult> {
    constructor(
        @InjectLogger() logger: Logger,
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        private readonly settlement: SettlementService,
    ) {
        super(logger)
    }

    protected override async process(command: ConfirmPaymentCommand): Promise<ConfirmPaymentResult> {
        const { request } = command.params
        const at = this.clock.now()
        return this.entityManager.transaction((manager) =>
            this.settlement.apply({
                manager,
                gatewayIntentId: request.gatewayIntentId,
                outcome: request.outcome,
                periodEnd: request.periodEnd,
                at,
            }),
        )
    }
}

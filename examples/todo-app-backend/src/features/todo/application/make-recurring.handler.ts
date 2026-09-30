import { CommandHandler } from "@nestjs/cqrs"
import { RuleService } from "@modules/domain/recur"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ok } from "@modules/platform/primitives"
import type { EntityManager } from "typeorm"
import { MakeRecurringCommand } from "./make-recurring.command"
import type { MakeRecurringResult } from "./make-recurring.contracts"

@CommandHandler(MakeRecurringCommand)
/**
 * Creates exactly one recurrence rule owned by the caller. A day of month that some months lack, such as the 31st, is
 * accepted: those months are skipped at generation. Only a shape that does not fit the frequency is refused.
 */
export class MakeRecurringHandler extends ICQRSHandler<MakeRecurringCommand, MakeRecurringResult> {
    constructor(
        @InjectLogger() logger: Logger,
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly rules: RuleService,
    ) {
        super(logger)
    }

    protected override async process(command: MakeRecurringCommand): Promise<MakeRecurringResult> {
        const { request, principal } = command.params
        const created = await this.entityManager.transaction((manager) =>
            this.rules.create({ manager, ownerId: principal.id, ...request }),
        )
        if (created.kind === "refused") return created
        const rule = created.value
        return ok({
            ruleId: rule.id,
            title: rule.title,
            frequency: rule.frequency,
            timeZone: rule.timeZone,
            time: rule.time,
            startDate: rule.startDate,
        })
    }
}

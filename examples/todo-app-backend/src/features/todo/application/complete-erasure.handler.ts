import { CommandHandler } from "@nestjs/cqrs"
import { AuditErasureService } from "@modules/domain/audit"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { CompleteErasureCommand } from "./complete-erasure.command"
import type { CompleteErasureResult } from "./complete-erasure.contracts"

@CommandHandler(CompleteErasureCommand)
/** Completes a verified erasure request of the caller: the subject key is destroyed and the person id dropped. */
export class CompleteErasureHandler extends ICQRSHandler<CompleteErasureCommand, CompleteErasureResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly erasure: AuditErasureService,
    ) {
        super(logger)
    }

    protected override async process(command: CompleteErasureCommand): Promise<CompleteErasureResult> {
        const { request, principal } = command.params
        return this.erasure.completeForCaller({ requestId: request.requestId, callerId: principal.id })
    }
}

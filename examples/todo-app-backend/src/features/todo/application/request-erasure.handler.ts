import { CommandHandler } from "@nestjs/cqrs"
import { AuditErasureService } from "@modules/domain/audit"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { RequestErasureCommand } from "./request-erasure.command"
import type { RequestErasureResult } from "./request-erasure.contracts"

@CommandHandler(RequestErasureCommand)
/** Opens the caller's erasure request and verifies it in the same step, since the caller is the subject. */
export class RequestErasureHandler extends ICQRSHandler<RequestErasureCommand, RequestErasureResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly erasure: AuditErasureService,
    ) {
        super(logger)
    }

    protected override async process(command: RequestErasureCommand): Promise<RequestErasureResult> {
        const { principal } = command.params
        return this.erasure.requestForCaller({ personId: principal.id })
    }
}

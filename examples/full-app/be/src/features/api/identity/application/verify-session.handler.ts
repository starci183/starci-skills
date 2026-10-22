import { QueryHandler } from "@nestjs/cqrs"
import { SessionService } from "@modules/domain/session"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { VerifySessionResult } from "./verify-session.contracts"
import { VerifySessionQuery } from "./verify-session.query"

@QueryHandler(VerifySessionQuery)
/** Names the person behind a live token; a token no session answers is a refusal, never a silent null. */
export class VerifySessionHandler extends ICQRSHandler<VerifySessionQuery, VerifySessionResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly sessions: SessionService,
    ) {
        super(logger)
    }

    protected override process(query: VerifySessionQuery): Promise<VerifySessionResult> {
        return this.sessions.authenticate(query.params.request.sessionToken)
    }
}

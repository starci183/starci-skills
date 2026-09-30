import { QueryHandler } from "@nestjs/cqrs"
import { SessionErrorCode, SessionService } from "@modules/domain/session"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ok, refused } from "@modules/platform/primitives"
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

    protected override async process(query: VerifySessionQuery): Promise<VerifySessionResult> {
        const session = await this.sessions.verify(query.params.request.sessionToken)
        return session === null ? refused(SessionErrorCode.Invalid) : ok(session)
    }
}

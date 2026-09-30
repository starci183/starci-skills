import { CommandHandler } from "@nestjs/cqrs"
import { SessionErrorCode, SessionService } from "@modules/domain/session"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ok, refused } from "@modules/platform/primitives"
import type { RevokeSessionResult } from "./revoke-session.contracts"
import { RevokeSessionCommand } from "./revoke-session.command"

@CommandHandler(RevokeSessionCommand)
/** Ends a session, but only one that belongs to the caller: someone else token answers the same refusal as an unknown one. */
export class RevokeSessionHandler extends ICQRSHandler<RevokeSessionCommand, RevokeSessionResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly sessions: SessionService,
    ) {
        super(logger)
    }

    protected override async process(command: RevokeSessionCommand): Promise<RevokeSessionResult> {
        const { request, principal } = command.params
        const session = await this.sessions.verify(request.sessionToken)
        if (session === null || session.personId !== principal.id) return refused(SessionErrorCode.Invalid)
        await this.sessions.revoke(request.sessionToken)
        return ok({ revoked: true })
    }
}

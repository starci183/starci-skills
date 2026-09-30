import { CommandHandler } from "@nestjs/cqrs"
import { SessionService } from "@modules/domain/session"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { RevokeSessionResult } from "./revoke-session.contracts"
import { RevokeSessionCommand } from "./revoke-session.command"

@CommandHandler(RevokeSessionCommand)
/** Ends a session, but only one that belongs to the caller: the session service answers a token of someone else like an unknown one. */
export class RevokeSessionHandler extends ICQRSHandler<RevokeSessionCommand, RevokeSessionResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly sessions: SessionService,
    ) {
        super(logger)
    }

    protected override process(command: RevokeSessionCommand): Promise<RevokeSessionResult> {
        const { request, principal } = command.params
        return this.sessions.revokeOwn({ personId: principal.id, sessionToken: request.sessionToken })
    }
}

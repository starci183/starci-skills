import {
    Injectable 
} from "@nestjs/common"
import {
    CommandHandler 
} from "@nestjs/cqrs"
import {
    AbstractCommandHandler 
} from "@modules/platform/cqrs/abstract-handler"
import {
    randomUUID 
} from "node:crypto"
import {
    KeycloakClient 
} from "@modules/integrations/keycloak/keycloak.client"
import {
    PlatformEventBus 
} from "@modules/platform/events/event-bus.providers"
import {
    SignedOutEvent 
} from "@modules/platform/events/events.types"
import {
    SessionService 
} from "./session.service"
import {
    SignOutCommand, SignOutCommandResult 
} from "./sign-out.command"

/**
 * fr.login.sign-out (composes br.login.session.restores): the session ends and the next request against
 * that token is unauthenticated. Revocation mirrors sds.login.session-store's t-revoke transition: the
 * row is deleted so the next read of that token finds nothing. event.login.signed-out is published after
 * the revoke succeeds, regardless of whether the best-effort remote Keycloak notification lands.
 *
 * Ported from the former `SignOutUseCase`; see sign-in.handler.ts's comment for the CQRS move.
 */
@Injectable()
@CommandHandler(SignOutCommand)
/** Decorated CQRS command handler; the bus dispatches to it and process() does the work (the abstract base keeps execute() a template). */
export class SignOutHandler extends AbstractCommandHandler<SignOutCommand, SignOutCommandResult> {
    constructor(
    private readonly sessionService: SessionService,
    private readonly events: PlatformEventBus,
    private readonly keycloakClient: KeycloakClient,
    ) {
        super()
    }

    protected override async process(command: SignOutCommand): Promise<SignOutCommandResult> {
        const session = await this.sessionService.findActive(command.params.sessionToken)
        await this.sessionService.tRevoke(command.params.sessionToken)
        this.events.publish(new SignedOutEvent(session.personId,
            new Date(),
            randomUUID()))
        try {
            await this.keycloakClient.notifySignOut(session.personId)
        } catch {
            // Best-effort remote notification; the local revoke already happened and must not be undone by it.
        }
        return {
            signedOut: true 
        }
    }
}

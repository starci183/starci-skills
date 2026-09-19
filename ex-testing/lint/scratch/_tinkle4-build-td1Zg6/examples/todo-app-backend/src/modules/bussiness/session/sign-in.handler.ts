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
    KeycloakInvalidCredentialsException 
} from "@modules/shared/exceptions/errors/keycloak/keycloak-invalid-credentials"
import {
    PlatformEventBus 
} from "@modules/platform/events/event-bus.providers"
import {
    SignedInEvent 
} from "@modules/platform/events/events.types"
import {
    SessionService 
} from "./session.service"
import {
    InvalidCredentialsException 
} from "@modules/shared/exceptions/errors/session/invalid-credentials"

import {
    SignInCommand, SignInCommandResult 
} from "./sign-in.command"

/**
 * br.login.password.sign-in: a sign-in succeeds only when Keycloak accepts the pair. Keycloak wins over
 * the earlier local-hash design (data.login.person, nfr.login.sign-in-timing's decoy hash): the product
 * never sees or stores a password, and the uniform refusal required by br.login.password.sign-in and
 * nfr.login.sign-in-timing comes from Keycloak's own direct access grant already answering an unknown
 * email and a wrong password with the same invalid_grant response, in one round-trip.
 *
 * Ported from the former `SignInUseCase` (a `features/sign-in/application` use case spanning two domain
 * modules) into a CQRS command handler owned by the `bussiness/session` capability, which imports
 * `KeycloakModule` the same way the former `SignInModule` did - the orchestration moves, the module
 * graph it depends on does not.
 */
@Injectable()
@CommandHandler(SignInCommand)
/** Decorated CQRS command handler; the bus dispatches to it and process() does the work (the abstract base keeps execute() a template). */
export class SignInHandler extends AbstractCommandHandler<SignInCommand, SignInCommandResult> {
    constructor(
    private readonly sessionService: SessionService,
    private readonly keycloakClient: KeycloakClient,
    private readonly events: PlatformEventBus,
    ) {
        super()
    }

    protected override async process(command: SignInCommand): Promise<SignInCommandResult> {
        const { params } = command
        this.sessionService.tBegin(params.email)
        let personId: string
        try {
            const result = await this.keycloakClient.signIn(params.email,
                params.password)
            personId = result.subject
        } catch (error) {
            this.sessionService.tRefuse()
            if (error instanceof KeycloakInvalidCredentialsException) {
                throw new InvalidCredentialsException({
                })
            }
            throw error
        }
        const session = await this.sessionService.tAccept(personId)
        this.events.publish(new SignedInEvent(personId,
            session.issuedAt,
            randomUUID()))
        return {
            sessionToken: session.token, personId 
        }
    }
}

import { randomUUID } from "node:crypto"
import { CommandHandler } from "@nestjs/cqrs"
import { AuditAction, toAuditAppendMessage } from "@modules/domain/audit"
import { IdentityErrorCode, SessionService, isPlausibleEmail } from "@modules/domain/identity"
import { InjectKeycloak, KeycloakError, KeycloakErrorCode } from "@modules/integrations/keycloak"
import type { KeycloakClient } from "@modules/integrations/keycloak"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { InjectOutbox } from "@modules/platform/outbox"
import type { Outbox } from "@modules/platform/outbox"
import { ok, refused } from "@modules/platform/primitives"
import type { EntityManager } from "typeorm"
import { SignInCommand } from "./sign-in.command"
import type { SignInResult } from "./sign-in.contracts"

/** How each provider failure is told to the caller: the refusal stays uniform, an outage is its own answer. */
const REFUSAL_OF: Record<
    KeycloakErrorCode,
    IdentityErrorCode.InvalidCredentials | IdentityErrorCode.ProviderUnavailable
> = {
    [KeycloakErrorCode.InvalidCredentials]: IdentityErrorCode.InvalidCredentials,
    [KeycloakErrorCode.ProviderUnavailable]: IdentityErrorCode.ProviderUnavailable,
}

@CommandHandler(SignInCommand)
/**
 * Signs a person in only when the identity provider accepts the pair. The provider is called before and outside any
 * transaction; the session row and the audit message are then written in one transaction, so the audit line exists
 * exactly when the session does. An unknown email and a wrong password give the same refusal.
 */
export class SignInHandler extends ICQRSHandler<SignInCommand, SignInResult> {
    constructor(
        @InjectLogger() logger: Logger,
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectOutbox() private readonly outbox: Outbox,
        @InjectKeycloak() private readonly keycloak: KeycloakClient,
        private readonly sessions: SessionService,
    ) {
        super(logger)
    }

    protected override async process(command: SignInCommand): Promise<SignInResult> {
        const { email, password } = command.params.request
        if (!isPlausibleEmail(email)) return refused(IdentityErrorCode.InvalidCredentials)
        let personId: string
        try {
            personId = (await this.keycloak.signIn({ email, password })).subject
        } catch (error) {
            if (error instanceof KeycloakError) return refused(REFUSAL_OF[error.code])
            throw error
        }
        const at = this.clock.now()
        const session = await this.entityManager.transaction(async (manager) => {
            const opened = await this.sessions.open({ manager, personId, at })
            await this.outbox.enqueue(
                manager,
                toAuditAppendMessage({
                    eventId: randomUUID(),
                    actorId: personId,
                    action: AuditAction.SignedIn,
                    target: null,
                    at,
                }),
            )
            return opened
        })
        return ok({ sessionToken: session.token, personId })
    }
}

import { randomUUID } from "node:crypto"
import { CommandHandler } from "@nestjs/cqrs"
import { AuditAction, toAuditAppendMessage } from "@modules/domain/audit"
import { SessionService } from "@modules/domain/session"
import { InjectKeycloak, KeycloakLogEvent } from "@modules/integrations/keycloak"
import type { KeycloakClient } from "@modules/integrations/keycloak"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { InjectOutbox } from "@modules/platform/outbox"
import type { Outbox } from "@modules/platform/outbox"
import { ok } from "@modules/platform/primitives"
import type { EntityManager } from "typeorm"
import { SignOutCommand } from "./sign-out.command"
import type { SignOutResult } from "./sign-out.contracts"

@CommandHandler(SignOutCommand)
/**
 * Ends the session behind the presented token. The session row is revoked together with the audit message, in one
 * transaction; the identity provider is told afterwards, outside the transaction, and a failure of that notice is only
 * logged: the local revoke already happened and must not be undone by it.
 */
export class SignOutHandler extends ICQRSHandler<SignOutCommand, SignOutResult> {
    constructor(
        @InjectLogger() private readonly log: Logger,
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectOutbox() private readonly outbox: Outbox,
        @InjectKeycloak() private readonly keycloak: KeycloakClient,
        private readonly sessions: SessionService,
    ) {
        super(log)
    }

    protected override async process(command: SignOutCommand): Promise<SignOutResult> {
        const token = command.params.request.sessionToken
        const at = this.clock.now()
        const found = await this.sessions.find({ token, at })
        if (found.kind === "refused") return found
        const { personId } = found.value
        await this.entityManager.transaction(async (manager) => {
            await this.sessions.revoke({ manager, token })
            await this.outbox.enqueue(
                manager,
                toAuditAppendMessage({
                    eventId: randomUUID(),
                    actorId: personId,
                    action: AuditAction.SignedOut,
                    target: null,
                    at,
                }),
            )
        })
        await this.notifyProvider(personId)
        return ok({ signedOut: true })
    }

    private async notifyProvider(personId: string): Promise<void> {
        try {
            await this.keycloak.notifySignOut({ personId })
        } catch (error) {
            this.log.error(KeycloakLogEvent.SignOutNotifyFailed, error)
        }
    }
}

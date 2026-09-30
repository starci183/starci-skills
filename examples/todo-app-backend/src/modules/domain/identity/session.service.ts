import { randomUUID } from "node:crypto"
import { Injectable } from "@nestjs/common"
import { AuditAction, toAuditAppendMessage } from "@modules/domain/audit"
import { InjectKeycloak, KeycloakError, KeycloakErrorCode, KeycloakLogEvent } from "@modules/integrations/keycloak"
import type { KeycloakClient } from "@modules/integrations/keycloak"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import type { Principal } from "@modules/platform/cqrs"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { InjectOutbox } from "@modules/platform/outbox"
import type { Outbox } from "@modules/platform/outbox"
import { ok, refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import type { EntityManager } from "typeorm"
import { isPlausibleEmail } from "./email.policy"
import { IdentityErrorCode } from "./errors/identity.error"
import { SessionEntity } from "./persistence/entities/session.entity"
import { PURGE_LAPSED_SESSIONS } from "./persistence/session.sql"
import { toSessionView } from "./persistence/session.rows"
import type {
    FindSessionParams,
    OpenSessionParams,
    PurgeSessionsParams,
    PurgeSessionsResult,
    RevokeSessionParams,
    SessionView,
    SignInOutcome,
    SignInParams,
    SignOutOutcome,
    SignOutParams,
} from "./identity.contracts"
import { InjectIdentityOptions } from "./identity.decorators"
import type { IdentityOptions } from "./identity.options"

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000

/** How each provider failure is told to the caller: the refusal stays uniform, an outage is its own answer. */
const REFUSAL_OF: Record<
    KeycloakErrorCode,
    IdentityErrorCode.InvalidCredentials | IdentityErrorCode.ProviderUnavailable
> = {
    [KeycloakErrorCode.InvalidCredentials]: IdentityErrorCode.InvalidCredentials,
    [KeycloakErrorCode.ProviderUnavailable]: IdentityErrorCode.ProviderUnavailable,
}

@Injectable()
/**
 * The session store: one row per live session, expiry enforced on read so a stopped sweeper can never leave a session
 * alive past its time. A refusal of a read is returned as an outcome; the guard turns it into the error.
 */
export class SessionService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectIdentityOptions() private readonly options: IdentityOptions,
        @InjectClock() private readonly clock: Clock,
        @InjectOutbox() private readonly outbox: Outbox,
        @InjectKeycloak() private readonly keycloak: KeycloakClient,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /**
     * Signs a person in only when the identity provider accepts the pair. The provider is called before and outside any
     * transaction; the session row and the audit message are then written in one transaction, so the audit line exists
     * exactly when the session does. An unknown email and a wrong password give the same refusal.
     */
    async signIn(params: SignInParams): Promise<SignInOutcome> {
        const { email, password } = params
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
            const opened = await this.open({ manager, personId, at })
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

    /**
     * Ends the session behind the presented token. The session row is revoked together with the audit message, in one
     * transaction; the identity provider is told afterwards, outside the transaction, and a failure of that notice is
     * only logged: the local revoke already happened and must not be undone by it.
     */
    async signOut(params: SignOutParams): Promise<SignOutOutcome> {
        const token = params.sessionToken
        const at = this.clock.now()
        const found = await this.find({ token, at })
        if (found.kind === "refused") return found
        const { personId } = found.value
        await this.entityManager.transaction(async (manager) => {
            await this.revoke({ manager, token })
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
        try {
            await this.keycloak.notifySignOut({ personId })
        } catch (error) {
            this.logger.error(KeycloakLogEvent.SignOutNotifyFailed, error)
        }
        return ok({ signedOut: true })
    }

    /** Opens a session for a person, valid for the configured number of days. */
    private async open(params: OpenSessionParams): Promise<SessionView> {
        const expiresAt = new Date(params.at.getTime() + this.options.ttlDays * MILLISECONDS_PER_DAY)
        const saved = await params.manager.save(SessionEntity, {
            token: randomUUID(),
            personId: params.personId,
            issuedAt: params.at,
            expiresAt,
        })
        return toSessionView(saved)
    }

    /**
     * The live session behind a token. An empty token is refused before any query: TypeORM drops an undefined
     * criterion from the WHERE clause, so a lookup on it would match an arbitrary row.
     */
    async find(params: FindSessionParams): Promise<Outcome<SessionView, IdentityErrorCode.NotFound | IdentityErrorCode.Expired>> {
        if (!params.token) return refused(IdentityErrorCode.NotFound, { reason: "missing-token" })
        const row = await this.entityManager.findOneBy(SessionEntity, { token: params.token })
        if (!row) return refused(IdentityErrorCode.NotFound)
        if (row.expiresAt.getTime() <= params.at.getTime()) return refused(IdentityErrorCode.Expired)
        return ok(toSessionView(row))
    }

    /** Ends a session outright. */
    private async revoke(params: RevokeSessionParams): Promise<void> {
        await params.manager.delete(SessionEntity, params.token)
    }

    /** Deletes every session that lapsed at or before the instant, in one transaction, and answers how many. */
    async purgeLapsed(params: PurgeSessionsParams): Promise<PurgeSessionsResult> {
        const purged = await this.entityManager.transaction(async (manager) => {
            // A DELETE ... RETURNING answers the deleted rows and their count.
            const [, count]: [Array<object>, number] = await manager.query(PURGE_LAPSED_SESSIONS, [params.at])
            return count
        })
        return { purged }
    }

    /** The principal of an authenticated person: a member, and an administrator when the deployment roster names them. */
    principalOf(personId: string): Principal {
        return { id: personId, roles: this.options.adminSubjects.includes(personId) ? ["member", "admin"] : ["member"] }
    }
}

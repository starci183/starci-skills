import { Injectable } from "@nestjs/common"
import { randomUUID } from "node:crypto"
import { InjectCache } from "@modules/integrations/cache"
import type { Cache } from "@modules/integrations/cache"
import { InjectKeycloak, KeycloakLogEvent } from "@modules/integrations/keycloak"
import type { KeycloakClient } from "@modules/integrations/keycloak"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ok, refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import { SessionErrorCode } from "./errors/session.error"
import type {
    IssuedSession,
    IssueSessionParams,
    LiveSession,
    RevokeOwnSessionParams,
    RevokedSession,
    SessionLookupResult,
    StoredSession,
} from "./session.contracts"
import { SESSION_KEY } from "./session.cache-keys"

@Injectable()
/**
 * Issue, look up and revoke the opaque bearer sessions kept in the cache; a token is a random uuid, never a self-describing
 * credential. A session keeps the identity provider's refresh token of its sign-in, so signing out also ends the provider
 * session; that call is made after the local revoke and its failure is only logged.
 */
export class SessionService {
    constructor(
        @InjectCache() private readonly cache: Cache,
        @InjectKeycloak() private readonly keycloak: KeycloakClient,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** Starts a session for `personId` and answers its token. */
    async issue(params: IssueSessionParams): Promise<IssuedSession> {
        const sessionToken = randomUUID()
        await this.cache.set({
            key: SESSION_KEY,
            args: [sessionToken],
            value: { personId: params.personId, providerRefreshToken: params.providerRefreshToken },
        })
        return { sessionToken, personId: params.personId }
    }

    /** The person behind a live token, or null when the token has no session. */
    async verify(sessionToken: string): Promise<SessionLookupResult> {
        const stored = await this.stored(sessionToken)
        return stored === null ? null : { personId: stored.personId }
    }

    /** The person behind a live token; a token no session answers is a refusal, never a silent null. */
    async authenticate(sessionToken: string): Promise<Outcome<LiveSession, SessionErrorCode.Invalid>> {
        const session = await this.verify(sessionToken)
        return session === null ? refused(SessionErrorCode.Invalid) : ok(session)
    }

    /**
     * Ends a session, but only one that belongs to the person: a token of someone else answers the same refusal as an unknown
     * one. The provider session the sign-in opened is ended afterwards with its refresh token.
     */
    async revokeOwn(params: RevokeOwnSessionParams): Promise<Outcome<RevokedSession, SessionErrorCode.Invalid>> {
        const stored = await this.stored(params.sessionToken)
        if (stored?.personId !== params.personId) return refused(SessionErrorCode.Invalid)
        await this.cache.del({ key: SESSION_KEY, args: [params.sessionToken] })
        try {
            await this.keycloak.notifySignOut({ refreshToken: stored.providerRefreshToken })
        } catch (error) {
            this.logger.error(KeycloakLogEvent.SignOutNotifyFailed, error)
        }
        return ok({ revoked: true })
    }

    /** What the cache keeps behind a token; a blank token is never looked up. */
    private stored(sessionToken: string): Promise<StoredSession | null> {
        if (sessionToken === "") return Promise.resolve(null)
        return this.cache.get({ key: SESSION_KEY, args: [sessionToken] })
    }
}

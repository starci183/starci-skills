import { Injectable } from "@nestjs/common"
import { randomUUID } from "node:crypto"
import { InjectCache } from "@modules/integrations/cache"
import type { Cache } from "@modules/integrations/cache"
import type { IssuedSession, IssueSessionParams, SessionLookupResult } from "./session.contracts"
import { SESSION_KEY } from "./session.cache-keys"

@Injectable()
/** Issue, look up and revoke the opaque bearer sessions kept in the cache; a token is a random uuid, never a self-describing credential. */
export class SessionService {
    constructor(@InjectCache() private readonly cache: Cache) {}

    /** Starts a session for `personId` and answers its token. */
    async issue(params: IssueSessionParams): Promise<IssuedSession> {
        const sessionToken = randomUUID()
        await this.cache.set({ key: SESSION_KEY, args: [sessionToken], value: params.personId })
        return { sessionToken, personId: params.personId }
    }

    /** The person behind a live token, or null when the token has no session. */
    async verify(sessionToken: string): Promise<SessionLookupResult> {
        if (sessionToken === "") return null
        const personId = await this.cache.get({ key: SESSION_KEY, args: [sessionToken] })
        return personId === null ? null : { personId }
    }

    /** Ends the session of `sessionToken`; revoking an unknown token is not an error. */
    async revoke(sessionToken: string): Promise<void> {
        await this.cache.del({ key: SESSION_KEY, args: [sessionToken] })
    }
}

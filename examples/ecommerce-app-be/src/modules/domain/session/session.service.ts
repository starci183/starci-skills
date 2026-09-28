import {
    Injectable 
} from "@nestjs/common"
import {
    randomUUID 
} from "node:crypto"
import {
    AppConfigService 
} from "ecommerce-app-be/modules/platform/config/identity"
import {
    SessionRepository 
} from "./session.repository"

/** What issue() hands back: the opaque bearer token plus the person it authenticates. */
export interface IssuedSessionResult {
  sessionToken: string;
  personId: string;
}

/** Person id behind a live bearer, or null when the bearer has no session. */
export type VerifiedSessionResult = string | null

@Injectable()
/** fr.identity.sign-in / br.identity.sign-in: issue, verify, revoke. The token is an opaque
 * uuid - never a self-describing credential - and a verification returns only the person. */
export class SessionService {
    constructor(
    private readonly sessions: SessionRepository,
    private readonly config: AppConfigService,
    ) {}

    async issue(personId: string): Promise<IssuedSessionResult> {
        const sessionToken = randomUUID()
        await this.sessions.store(sessionToken,
            personId,
            this.config.getSessionTtlSeconds())
        return {
            sessionToken, personId 
        }
    }

    async verify(sessionToken: string): Promise<VerifiedSessionResult> {
        if (!sessionToken) return null
        return this.sessions.lookup(sessionToken)
    }

    async revoke(sessionToken: string): Promise<void> {
        await this.sessions.forget(sessionToken)
    }
}

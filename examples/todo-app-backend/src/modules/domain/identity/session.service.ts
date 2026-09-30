import { randomUUID } from "node:crypto"
import { Injectable } from "@nestjs/common"
import type { Principal } from "@modules/platform/cqrs"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { ok, refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import type { EntityManager } from "typeorm"
import { IdentityErrorCode } from "./errors/identity.error"
import { SessionEntity } from "./persistence/entities/session.entity"
import { PURGE_LAPSED_SESSIONS } from "./persistence/session.sql"
import { toSessionView } from "./persistence/session.rows"
import type {
    FindSessionParams,
    OpenSessionParams,
    PurgeSessionsParams,
    RevokeSessionParams,
    SessionView,
} from "./identity.contracts"
import { InjectIdentityOptions } from "./identity.decorators"
import type { IdentityOptions } from "./identity.options"

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000

@Injectable()
/**
 * The session store: one row per live session, expiry enforced on read so a stopped sweeper can never leave a session
 * alive past its time. A refusal of a read is returned as an outcome; the guard turns it into the error.
 */
export class SessionService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectIdentityOptions() private readonly options: IdentityOptions,
    ) {}

    /** Opens a session for a person, valid for the configured number of days. */
    async open(params: OpenSessionParams): Promise<SessionView> {
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
    async revoke(params: RevokeSessionParams): Promise<void> {
        await params.manager.delete(SessionEntity, params.token)
    }

    /** Deletes every session that lapsed at or before the instant and answers how many. */
    async purgeLapsed(params: PurgeSessionsParams): Promise<number> {
        // A DELETE ... RETURNING answers the deleted rows and their count.
        const [, count]: [Array<object>, number] = await params.manager.query(PURGE_LAPSED_SESSIONS, [params.at])
        return count
    }

    /** The principal of an authenticated person: a member, and an administrator when the deployment roster names them. */
    principalOf(personId: string): Principal {
        return { id: personId, roles: this.options.adminSubjects.includes(personId) ? ["member", "admin"] : ["member"] }
    }
}

import {
    SessionService 
} from "@modules/bussiness/session/session.service"


const BEARER_PREFIX = /^Bearer\s+(.+)$/i

/**
 * The one place a task resolver turns the `Authorization: Bearer <token>` header into an authenticated
 * actor id. contract.login.identity-for-task's surface names this header explicitly (rev 3): it is the
 * same header name and value shape nivo-fe/nivo-backend use for their own access token
 * (`D:\Repositories\nivo-fe\apps\app\src\modules\api\graphql.ts` sends `authorization: Bearer <token>`),
 * chosen over the former custom `x-session-token` header this example used before rev 3 so the wire
 * mechanism matches nivo's convention. The token itself stays this app's own opaque, Postgres-backed
 * session id (`sds.login.session-store`) rather than a Keycloak-verified JWT - RFC 6750's Authorization
 * header is the standard way to present *any* bearer credential over HTTP, not only a JWT, so the
 * header name generalizes even though the verification underneath does not change.
 *
 * `SessionService.findActive` still does the same expiry/existence check and still throws the same
 * `SessionNotFoundException`/`SessionExpiredException` on failure, now refusing a missing/malformed
 * token before it ever reaches a query (see `session.service.ts#findActive`) - this is the fix for the
 * auth bypass a real-browser uat.verify run found on the pre-refactor REST controllers: an absent
 * header used to reach `findOneBy({ token: undefined })` and silently match an arbitrary session row.
 * This file exists so five task resolvers don't each repeat the header read and the SessionService call.
 */
export interface GraphqlRequestLike {
  readonly headers: Record<string, string | Array<string> | undefined>;
}

const bearerToken = (value: string | Array<string> | undefined): string => {
    const header = Array.isArray(value) ? value[0] : value
    if (!header) return ""
    const match = BEARER_PREFIX.exec(header)
    return match ? match[1] : ""
}

/** Resolves the request's `Authorization: Bearer` token through SessionService.findActive and returns the session's personId - the actor every resolver puts on its command or query. */
export const actorIdFromRequest = async (req: GraphqlRequestLike, sessionService: SessionService): Promise<string> => {
    const token = bearerToken(req.headers["authorization"])
    const session = await sessionService.findActive(token)
    return session.personId
}

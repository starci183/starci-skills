import type { RevokeSessionRequest, Revoked } from "../../application/revoke-session.contracts"
import type { RevokeSessionInput } from "./dto/revoke-session.input"
import type { RevokeSessionType } from "./dto/revoke-session.type"

/** Maps the GraphQL input to the command request. */
export const toRevokeSessionRequest = (input: RevokeSessionInput): RevokeSessionRequest => ({
    sessionToken: input.sessionToken,
})

/** Maps the confirmation to the GraphQL type. */
export const toRevokeSessionType = (result: Revoked): RevokeSessionType => ({ revoked: result.revoked })

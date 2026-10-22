import type { LiveSession } from "@modules/domain/session"
import type { VerifySessionRequest } from "../../application/verify-session.contracts"
import type { VerifySessionInput } from "./dto/verify-session.input"
import type { VerifySessionType } from "./dto/verify-session.type"

/** Maps the GraphQL input to the query request. */
export const toVerifySessionRequest = (input: VerifySessionInput): VerifySessionRequest => ({
    sessionToken: input.sessionToken,
})

/** Maps the live session to the GraphQL type. */
export const toVerifySessionType = (session: LiveSession): VerifySessionType => ({ personId: session.personId })

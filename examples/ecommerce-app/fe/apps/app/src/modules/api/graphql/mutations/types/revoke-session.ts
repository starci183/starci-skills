import type { RevokeSessionMutation, RevokeSessionMutationVariables } from "../../__generated__/graphql"

/** Whether the session was revoked. */
export type MutationRevokeSessionResponse = RevokeSessionMutation["revokeSession"]

/** The input of `revokeSession`. */
export type MutationRevokeSessionRequest = RevokeSessionMutationVariables["input"]

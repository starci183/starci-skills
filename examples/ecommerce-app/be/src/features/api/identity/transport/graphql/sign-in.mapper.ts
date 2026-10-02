import type { IssuedSession } from "@modules/domain/session"
import type { SignInRequest } from "../../application/sign-in.contracts"
import type { SignInInput } from "./dto/sign-in.input"
import type { SignInType } from "./dto/sign-in.type"

/** Maps the GraphQL input to the command request. */
export const toSignInRequest = (input: SignInInput): SignInRequest => ({
    email: input.email,
    password: input.password,
})

/** Maps the issued session to the GraphQL type. */
export const toSignInType = (session: IssuedSession): SignInType => ({
    sessionToken: session.sessionToken,
    personId: session.personId,
})

import type { SignedOut, SignOutRequest } from "../../application/sign-out.contracts"
import type { SignOutInput } from "./dto/sign-out.input"
import type { SignOutType } from "./dto/sign-out.type"

/** Maps the GraphQL input to the command request. */
export const toSignOutRequest = (input: SignOutInput): SignOutRequest => ({ sessionToken: input.sessionToken })

/** Maps the confirmation to the GraphQL type. */
export const toSignOutType = (signedOut: SignedOut): SignOutType => ({ signedOut: signedOut.signedOut })

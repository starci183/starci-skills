import {
    Args, Mutation, Resolver 
} from "@nestjs/graphql"
import {
    AccountService 
} from "@modules/bussiness/account/account.service"
import {
    SessionService 
} from "@modules/bussiness/session/session.service"
import {
    RequestInvalidException 
} from "@modules/platform/exceptions/errors/requests/request-invalid"
import {
    InvalidCredentialsException 
} from "@modules/platform/exceptions/errors/accounts/invalid-credentials"

import {
    SignInInput 
} from "./graphql-types/input"
import {
    SignInResponse 
} from "./graphql-types/response"

/**
 * GraphQL mutation for signIn - the transport of what used to be POST /auth/sign-in.
 * Protocol adaptation only: the same credential check, the same AccountService/SessionService
 * calls and the same named refusals the REST door produced; it makes no business decision itself.
 */
@Resolver()
/** The fr.identity.sign-in door: email+password in, a Redis-backed session token and personId
 * out - the anonymous mutation that establishes a session. A refusal names neither half
 * (br.identity.sign-in): unknown email and wrong password are the same error, same code. */
export class SignInResolver {
    constructor(
    private readonly accounts: AccountService,
    private readonly sessions: SessionService,
    ) {}

  @Mutation(() => SignInResponse,
      {
          name: "signIn",
          description: "Sign in with an email + password; returns the session token to send back as \"Authorization: Bearer <token>\".",
      })
    async signIn(@Args("input") input: SignInInput): Promise<SignInResponse> {
        const email = typeof input?.email === "string" ? input.email : ""
        const password = typeof input?.password === "string" ? input.password : ""
        if (!email || !password) {
            throw new RequestInvalidException({
                message: "email and password are required." 
            })
        }
        const personId = await this.accounts.verifyCredentials(email,
            password)
        if (!personId) {
            throw new InvalidCredentialsException({
            })
        }
        const issued = await this.sessions.issue(personId)
        return new SignInResponse(issued.sessionToken,
            issued.personId)
    }
}

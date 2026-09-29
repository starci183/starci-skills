import {
    Args, Mutation, Resolver 
} from "@nestjs/graphql"
import {
    AccountService 
} from "ecommerce-app-be/modules/domain/account"
import {
    SessionService 
} from "ecommerce-app-be/modules/domain/session"
import {
    RequestInvalidException 
} from "ecommerce-app-be/modules/platform/errors"
import {
    InvalidCredentialsException 
} from "ecommerce-app-be/modules/platform/errors"

import {
    IDENTITY_MESSAGES 
} from "../../../../../messages/index"
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
          description: IDENTITY_MESSAGES.get("signIn.description"),
      })
    async signIn(@Args("request") request: SignInInput): Promise<SignInResponse> {
        const email = typeof request?.email === "string" ? request.email : ""
        const password = typeof request?.password === "string" ? request.password : ""
        if (!email || !password) {
            throw new RequestInvalidException({
                message: IDENTITY_MESSAGES.get("signIn.invalid") 
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

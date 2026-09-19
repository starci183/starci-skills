import {
    Args, Mutation, Resolver 
} from "@nestjs/graphql"
import {
    AccountService 
} from "@modules/bussiness/account/account.service"
import {
    RequestInvalidException 
} from "@modules/platform/exceptions/errors/requests/request-invalid"
import {
    EmailTakenException 
} from "@modules/platform/exceptions/errors/accounts/email-taken"

import {
    RegisterInput 
} from "./graphql-types/input"
import {
    RegisterResponse 
} from "./graphql-types/response"

/**
 * GraphQL mutation for register - the transport of what used to be POST /auth/register.
 * Protocol adaptation only: the same credential check, the same AccountService call and the
 * same named refusals the REST door produced; it makes no business decision itself.
 */
@Resolver()
/** The demo signup door - what makes the live proof repeatable: every run registers a fresh
 * visitor instead of reusing the seeded person. A taken address is EMAIL_TAKEN, nothing else. */
export class RegisterResolver {
    constructor(private readonly accounts: AccountService) {}

  @Mutation(() => RegisterResponse,
      {
          name: "register",
          description: "Register a fresh visitor with an email + password; answers the new person id, or EMAIL_TAKEN for a taken address.",
      })
    async register(@Args("input") input: RegisterInput): Promise<RegisterResponse> {
        const email = typeof input?.email === "string" ? input.email : ""
        const password = typeof input?.password === "string" ? input.password : ""
        if (!email.includes("@") || password.length < 8) {
            throw new RequestInvalidException({
                message: "A plausible email and a password of at least 8 characters are required." 
            })
        }
        const personId = await this.accounts.register(email,
            password)
        if (!personId) {
            throw new EmailTakenException({
            })
        }
        return new RegisterResponse(personId)
    }
}

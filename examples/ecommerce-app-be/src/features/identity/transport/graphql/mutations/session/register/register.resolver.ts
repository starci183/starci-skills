import {
    Args, Mutation, Resolver 
} from "@nestjs/graphql"
import {
    AccountService 
} from "ecommerce-app-be/modules/domain/account"
import {
    RequestInvalidException 
} from "ecommerce-app-be/modules/platform/errors"
import {
    EmailTakenException 
} from "ecommerce-app-be/modules/platform/errors"

import {
    IDENTITY_MESSAGES 
} from "../../../../../messages/index"
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
          description: IDENTITY_MESSAGES.get("register.description"),
      })
    async register(@Args("request") request: RegisterInput): Promise<RegisterResponse> {
        const email = typeof request?.email === "string" ? request.email : ""
        const password = typeof request?.password === "string" ? request.password : ""
        if (!email.includes("@") || password.length < 8) {
            throw new RequestInvalidException({
                message: IDENTITY_MESSAGES.get("register.invalid") 
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

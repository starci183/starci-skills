import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { Public, PublicReason, IdentityError } from "@modules/domain/identity"
import { InjectCommandBus } from "@modules/platform/cqrs"
import { RateLimit, RateTier } from "@modules/platform/http-security"
import { unwrapOutcome } from "@modules/platform/primitives"
import { SignInCommand } from "../../application/sign-in.command"
import { SignInInput } from "./dto/sign-in.input"
import { SignInType } from "./dto/sign-in.type"
import { toSignInRequest, toSignInType } from "./sign-in.mapper"

@Resolver()
/** GraphQL door of signIn, the one anonymous way to obtain a session. */
export class SignInResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Signs a person in with email and password; the answer is the session token. */
    @Mutation(() => SignInType, { name: "signIn" })
    @Public({ reason: PublicReason.AuthHandshake })
    @RateLimit(RateTier.Strict)
    async signIn(@Args("input") input: SignInInput): Promise<SignInType> {
        const outcome = await this.commandBus.execute(new SignInCommand({ request: toSignInRequest(input) }))
        return toSignInType(unwrapOutcome(outcome, IdentityError))
    }
}

import { Args, Mutation, Resolver } from "@nestjs/graphql"
import type { CommandBus } from "@nestjs/cqrs"
import { AccountError } from "@modules/domain/account"
import { PublicReason, Public } from "@modules/domain/identity"
import { InjectCommandBus } from "@modules/platform/cqrs"
import { RateLimit, RateTier } from "@modules/platform/http-security"
import { unwrapOutcome } from "@modules/platform/primitives"
import { SignInCommand } from "../../application/sign-in.command"
import { SignInInput } from "./dto/sign-in.input"
import { SignInType } from "./dto/sign-in.type"
import { toSignInRequest, toSignInType } from "./sign-in.mapper"

@Resolver()
/** GraphQL door of signIn: an anonymous handshake on the strict rate tier. */
export class SignInResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Signs in with an email and a password and answers a session token. */
    @Mutation(() => SignInType, { name: "signIn" })
    @Public({ reason: PublicReason.AuthHandshake })
    @RateLimit(RateTier.Strict)
    async signIn(@Args("request") input: SignInInput): Promise<SignInType> {
        const outcome = await this.commandBus.execute(new SignInCommand({ request: toSignInRequest(input) }))
        return toSignInType(unwrapOutcome(outcome, AccountError))
    }
}

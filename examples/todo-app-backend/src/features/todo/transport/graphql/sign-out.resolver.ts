import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { Public, PublicReason, SessionError } from "@modules/domain/session"
import { InjectCommandBus } from "@modules/platform/cqrs"
import { RateLimit, RateTier } from "@modules/platform/http-security"
import { unwrapOutcome } from "@modules/platform/primitives"
import { SignOutCommand } from "../../application/sign-out.command"
import { SignOutInput } from "./dto/sign-out.input"
import { SignOutType } from "./dto/sign-out.type"
import { toSignOutRequest, toSignOutType } from "./sign-out.mapper"

@Resolver()
/** GraphQL door of signOut: the token that ends is the input, not ambient authentication. */
export class SignOutResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Ends the session behind the given token. */
    @Mutation(() => SignOutType, { name: "signOut", description: "End a session by its token." })
    @Public({ reason: PublicReason.AuthHandshake })
    @RateLimit(RateTier.Strict)
    async signOut(@Args("request") input: SignOutInput): Promise<SignOutType> {
        const outcome = await this.commandBus.execute(new SignOutCommand({ request: toSignOutRequest(input) }))
        return toSignOutType(unwrapOutcome(outcome, SessionError))
    }
}

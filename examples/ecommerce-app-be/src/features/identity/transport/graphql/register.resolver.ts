import { Args, Mutation, Resolver } from "@nestjs/graphql"
import type { CommandBus } from "@nestjs/cqrs"
import { PublicReason, Public } from "@modules/domain/identity"
import { AccountError } from "@modules/domain/account"
import { InjectCommandBus } from "@modules/platform/cqrs"
import { RateLimit, RateTier } from "@modules/platform/http-security"
import { unwrapOutcome } from "@modules/platform/primitives"
import { RegisterCommand } from "../../application/register.command"
import { RegisterInput } from "./dto/register.input"
import { RegisterType } from "./dto/register.type"
import { toRegisterRequest, toRegisterType } from "./register.mapper"

@Resolver()
/** GraphQL door of register: an anonymous handshake on the strict rate tier. */
export class RegisterResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Registers a visitor as a person. */
    @Mutation(() => RegisterType, { name: "register" })
    @Public({ reason: PublicReason.AuthHandshake })
    @RateLimit(RateTier.Strict)
    async register(@Args("request") input: RegisterInput): Promise<RegisterType> {
        const outcome = await this.commandBus.execute(new RegisterCommand({ request: toRegisterRequest(input) }))
        return toRegisterType(unwrapOutcome(outcome, AccountError))
    }
}

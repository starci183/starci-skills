import { Module } from "@nestjs/common"
import { IdentityModule } from "../../identity.module"
import { AccountResolver } from "./account.resolver"
import { RegisterResolver } from "./register.resolver"
import { RevokeSessionResolver } from "./revoke-session.resolver"
import { SignInResolver } from "./sign-in.resolver"
import { VerifySessionResolver } from "./verify-session.resolver"

@Module({
    imports: [IdentityModule],
    providers: [RegisterResolver, SignInResolver, VerifySessionResolver, RevokeSessionResolver, AccountResolver],
})
/** The GraphQL transport of the identity feature. */
export class IdentityGraphqlModule {}

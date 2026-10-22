import { Module } from "@nestjs/common"
import { IdentityFeatureModule } from "../../identity.module"
import { AccountResolver } from "./account.resolver"
import { ConfigurableModuleClass } from "./identity-graphql.module-definition"
import { RegisterResolver } from "./register.resolver"
import { RevokeSessionResolver } from "./revoke-session.resolver"
import { SignInResolver } from "./sign-in.resolver"
import { VerifyServiceSessionResolver } from "./verify-service-session.resolver"
import { VerifySessionResolver } from "./verify-session.resolver"

@Module({
    imports: [IdentityFeatureModule.register({})],
    providers: [
        RegisterResolver,
        SignInResolver,
        VerifySessionResolver,
        VerifyServiceSessionResolver,
        RevokeSessionResolver,
        AccountResolver,
    ],
})
/** The GraphQL transport of the identity feature. */
export class IdentityGraphqlModule extends ConfigurableModuleClass {}

import { Module } from "@nestjs/common"
import type { DynamicModule, Provider } from "@nestjs/common"
import { AuthGuard } from "./auth.guard"
import { CredentialGuard } from "./credential.guard"
import { IdentityError, IdentityErrorCode } from "./errors/identity.error"
import { CREDENTIAL_AUTHENTICATOR } from "./identity.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./identity.module-definition"

const refusingAuthenticator: Provider = {
    provide: CREDENTIAL_AUTHENTICATOR,
    useValue: {
        authenticate: () => Promise.reject(new IdentityError({ code: IdentityErrorCode.Unauthenticated })),
    },
}

@Module({})
/** The identity capability: the credential guard and the guard that closes every door by default. The app registers them as APP_GUARDs after the throttler and the origin guard. */
export class IdentityModule extends ConfigurableModuleClass {
    /** Registers the capability once per app; the credential authenticator is the port the app binds. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        const authenticator: Provider =
            options.credentialAuthenticator === undefined
                ? refusingAuthenticator
                : { provide: CREDENTIAL_AUTHENTICATOR, useClass: options.credentialAuthenticator }
        return {
            ...base,
            providers: [...(base.providers ?? []), authenticator, CredentialGuard, AuthGuard],
            exports: [CredentialGuard, CREDENTIAL_AUTHENTICATOR, AuthGuard],
        }
    }
}

import {
    DynamicModule, Module 
} from "@nestjs/common"
import {
    IdentityApiClient 
} from "./identity.client"
import {
    ConfigurableModuleClass, OPTIONS_TYPE 
} from "./identity.module-definition"

@Module({
})
/**
 * The `identity` integration module: the order service's real HTTP client toward the identity
 * service. Its globality is declared at `apps/order`
 * (`IdentityModule.register({ isGlobal: true })`) - the session guard and the health probe reach
 * the client without importing a capability module.
 */
export class IdentityModule extends ConfigurableModuleClass {
    static register(options: typeof OPTIONS_TYPE = {
    }): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []),
                IdentityApiClient],
            exports: [IdentityApiClient],
        }
    }
}

import {
    DynamicModule, Module 
} from "@nestjs/common"
import {
    ConfigurableModuleClass, OPTIONS_TYPE 
} from "./sepay.module-definition"
import {
    SepayClient 
} from "./sepay.client"

/**
 * integration.plan.sepay: the one SePay client, registered the way nivo registers every capability -
 * matches keycloak.module.ts's shape exactly. No `imports: [ConfigModule]`: `ConfigModule` is registered
 * globally from `app.module.ts`, so `AppConfigService` is already visible to `SepayClient`.
 */
@Module({
})
/** Nest module wiring the sepay capability's providers; the app composition root registers it - other modules never import it. */
export class SepayModule extends ConfigurableModuleClass {
    static register(options: typeof OPTIONS_TYPE = {
    }): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []),
                SepayClient],
            exports: [SepayClient],
        }
    }
}

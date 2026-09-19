import {
    DynamicModule, Module 
} from "@nestjs/common"
import {
    AppConfigService 
} from "./app-config.service"
import {
    ConfigurableModuleClass, OPTIONS_TYPE 
} from "./config.module-definition"

@Module({
})
/** Nest module wiring the config capability's providers; the app composition root registers it - other modules never import it. */
export class ConfigModule extends ConfigurableModuleClass {
    static register(options: typeof OPTIONS_TYPE = {
    }): DynamicModule {
        const base = super.register(options)
        return {
            ...base, providers: [...(base.providers ?? []),
                AppConfigService], exports: [AppConfigService] 
        }
    }
}

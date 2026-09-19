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
/**
 * The order service's config module (sibling of the identity one's): the class token is the
 * provider and the export, and whether it is app-wide is declared at `apps/order`
 * (`ConfigModule.register({ isGlobal: true })`) because AppConfigService is genuinely app-wide
 * there - the database and the identity client resolve their binding through it.
 */
export class ConfigModule extends ConfigurableModuleClass {
    static register(options: typeof OPTIONS_TYPE = {
    }): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []),
                AppConfigService],
            exports: [AppConfigService],
        }
    }
}

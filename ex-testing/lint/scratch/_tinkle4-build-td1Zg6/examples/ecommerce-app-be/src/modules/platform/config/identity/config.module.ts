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
 * The identity service's config module: the class token is the provider and the export. Whether
 * it is app-wide is declared at `apps/identity` (`ConfigModule.register({ isGlobal: true })`) -
 * because AppConfigService is genuinely app-wide there: the database, the cache and every HTTP
 * client resolve their binding through it, and every port and URL they need is read from
 * metadata.json rather than restated as a literal.
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

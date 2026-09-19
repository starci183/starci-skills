import {
    DynamicModule, Module 
} from "@nestjs/common"
import {
    RedisPrimaryClient 
} from "./redis.client"
import {
    ConfigurableModuleClass, OPTIONS_TYPE 
} from "./redis.module-definition"

@Module({
})
/**
 * The identity service's one Redis handle as a Nest module. Whether it is app-wide is declared
 * at `apps/identity` (`RedisPrimaryModule.register({ isGlobal: true })`) - the session store and
 * the health probe both reach the client without importing this module themselves.
 */
export class RedisPrimaryModule extends ConfigurableModuleClass {
    static register(options: typeof OPTIONS_TYPE = {
    }): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []),
                RedisPrimaryClient],
            exports: [RedisPrimaryClient],
        }
    }
}

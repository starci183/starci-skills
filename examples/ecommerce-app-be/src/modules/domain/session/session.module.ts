import {
    DynamicModule, Module 
} from "@nestjs/common"
import {
    SessionRepository 
} from "./session.repository"
import {
    SessionService 
} from "./session.service"
import {
    ConfigurableModuleClass, OPTIONS_TYPE 
} from "./session.module-definition"

@Module({
})
/**
 * The `session` capability module: issue, verify, revoke for the opaque bearer tokens. Its
 * collaborators are app-wide registrations `apps/identity` declares - the Redis client the
 * repository wraps and the config service the TTL comes from - and this module's own globality
 * is declared there too (`SessionModule.register({ isGlobal: true })`), so the identity feature
 * never imports a capability.
 */
export class SessionModule extends ConfigurableModuleClass {
    static register(options: typeof OPTIONS_TYPE = {
    }): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []),
                SessionRepository,
                SessionService],
            exports: [SessionService],
        }
    }
}

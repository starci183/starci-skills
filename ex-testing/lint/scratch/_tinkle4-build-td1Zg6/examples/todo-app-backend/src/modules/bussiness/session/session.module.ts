import {
    DynamicModule, Module 
} from "@nestjs/common"
import {
    CqrsModule 
} from "@nestjs/cqrs"
import {
    ConfigurableModuleClass, OPTIONS_TYPE 
} from "./session.module-definition"
import {
    SessionService 
} from "./session.service"
import {
    SignInHandler 
} from "./sign-in.handler"
import {
    SignOutHandler 
} from "./sign-out.handler"

/**
 * The `session` capability module, under nivo's `modules/bussiness/<capability>` shape (renamed from the
 * former `modules/domain/session` + two separate `features/sign-in|sign-out` folders). Owns
 * SessionService and the sign-in/sign-out CQRS handlers. `KeycloakModule` is not imported here: it is
 * registered globally from `app.module.ts`, so the `KeycloakClient` the handlers inject resolves
 * ambiently.
 *
 * No `TypeOrmModule.forFeature(...)` here: `SessionService` reaches `SessionEntity` through
 * `@InjectPrimaryEntityManager()`, not a per-entity repository token - this capability has no
 * repository file and declares no persistence wiring of its own. `ConfigModule`/`PlatformEventsModule`
 * are not imported here either: both are registered globally from `app.module.ts`.
 */
@Module({
})
/** Nest module wiring the session capability's providers; the app composition root registers it - other modules never import it. */
export class SessionModule extends ConfigurableModuleClass {
    static register(options: typeof OPTIONS_TYPE = {
    }): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            imports: [CqrsModule],
            providers: [...(base.providers ?? []),
                SessionService,
                SignInHandler,
                SignOutHandler],
            exports: [SessionService],
        }
    }
}

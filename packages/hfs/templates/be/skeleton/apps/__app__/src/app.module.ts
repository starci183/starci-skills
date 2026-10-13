import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { APP_FILTER, APP_GUARD } from "@nestjs/core"
import { SystemHealthHttpModule } from "@features/api/system-health"
import { AuthGuard, IdentityModule } from "@modules/domain/identity"
import { LivenessModule } from "@modules/domain/liveness"
import { NoteModule } from "@modules/domain/note"
import { ErrorsFilter } from "@modules/platform/errors"
import { OriginGuard, RateLimitGuard } from "@modules/platform/http-security"
import { platformModules } from "./compose/platform"
import type { {{appPascal}}Options } from "./{{app}}.options"

@Module({})
/** Composition root of the {{app}} app: it spreads the composition groups of `compose/`, and the three guards run in a fixed order. */
export class AppModule {
    /** Builds the module from options parsed once at boot; nothing here reads the environment. */
    static register(options: {{appPascal}}Options): DynamicModule {
        return {
            module: AppModule,
            imports: [
                ...platformModules(options),
                IdentityModule.register({ isGlobal: true }),
                LivenessModule.register({ isGlobal: true }),
                NoteModule.register({ isGlobal: true }),
                SystemHealthHttpModule,
            ],
            providers: [
                { provide: APP_FILTER, useClass: ErrorsFilter },
                { provide: APP_GUARD, useClass: RateLimitGuard },
                { provide: APP_GUARD, useClass: OriginGuard },
                { provide: APP_GUARD, useClass: AuthGuard },
            ],
        }
    }
}

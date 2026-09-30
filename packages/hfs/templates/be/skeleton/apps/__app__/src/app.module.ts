import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { APP_FILTER } from "@nestjs/core"
import { SystemHealthHttpModule } from "@features/system-health"
import { LivenessModule } from "@modules/domain/liveness"
import { ClockModule } from "@modules/platform/clock"
import { SERVER_OPTIONS } from "@modules/platform/config"
import { CqrsModule } from "@modules/platform/cqrs"
import { ErrorFilter } from "@modules/platform/errors"
import { LoggingModule } from "@modules/platform/logging"
import type { {{appPascal}}Options } from "./{{app}}.options"

@Module({})
/** Composition root of the {{app}} app: every capability is registered once, app-wide, the features it runs and its one error filter. */
export class AppModule {
    /** Builds the module from options parsed once at boot; nothing here reads the environment. */
    static register(options: {{appPascal}}Options): DynamicModule {
        return {
            module: AppModule,
            imports: [
                ClockModule.register({ isGlobal: true }),
                LoggingModule.register({ isGlobal: true }),
                CqrsModule.register({ isGlobal: true }),
                LivenessModule.register({ isGlobal: true }),
                SystemHealthHttpModule,
            ],
            providers: [
                { provide: SERVER_OPTIONS, useValue: options.server },
                { provide: APP_FILTER, useClass: ErrorFilter },
            ],
        }
    }
}

import { DynamicModule, Module } from "@nestjs/common"
import { APP_FILTER } from "@nestjs/core"
import { SystemHealthModule } from "@features/system-health"
import { SERVER_OPTIONS } from "@modules/platform/config"
import { ErrorFilter } from "@modules/platform/errors"
import { LoggingModule } from "@modules/platform/logging"
import type { {{appPascal}}Options } from "./{{app}}.options"

/** Composition root of the {{app}} app: the features it runs, the platform it needs and its one error filter. */
@Module({})
export class AppModule {
    /** Builds the module from options parsed once at boot; nothing here reads the environment. */
    static register(options: {{appPascal}}Options): DynamicModule {
        return {
            module: AppModule,
            imports: [LoggingModule, SystemHealthModule],
            providers: [
                { provide: SERVER_OPTIONS, useValue: options.server },
                { provide: APP_FILTER, useClass: ErrorFilter },
            ],
        }
    }
}

import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { IDS } from "./ids.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./ids.module-definition"
import { UuidIds } from "./uuid-ids.service"

@Module({})
/** Provides the Ids port backed by random UUIDs. */
export class IdsModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), { provide: IDS, useClass: UuidIds }],
            exports: [IDS],
        }
    }
}

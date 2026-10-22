import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { IDS } from "./ids.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./ids.module-definition"
import { SystemIds } from "./system-ids.service"

@Module({})
/** Provides the Ids port backed by the system random source. */
export class IdsModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), { provide: IDS, useClass: SystemIds }],
            exports: [IDS],
        }
    }
}

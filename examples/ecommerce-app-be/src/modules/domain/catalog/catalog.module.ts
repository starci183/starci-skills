import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./catalog.module-definition"
import { CatalogService } from "./catalog.service"

@Module({})
/** The catalog capability over the order database. */
export class CatalogModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return { ...base, providers: [...(base.providers ?? []), CatalogService], exports: [CatalogService] }
    }
}

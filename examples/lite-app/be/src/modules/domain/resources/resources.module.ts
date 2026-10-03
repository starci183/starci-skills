import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./resources.module-definition"
import { ResourcesService } from "./resources.service"

@Module({})
/** The resources capability over the primary Supabase PostgreSQL connection. */
export class ResourcesModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return { ...base, providers: [...(base.providers ?? []), ResourcesService], exports: [ResourcesService] }
    }
}

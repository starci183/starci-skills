import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./{{name}}.module-definition"
import { {{Name}}Service } from "./{{name}}.service"

@Module({})
/** The {{name}} capability over the primary Supabase PostgreSQL connection. */
export class {{Name}}Module extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return { ...base, providers: [...(base.providers ?? []), {{Name}}Service], exports: [{{Name}}Service] }
    }
}

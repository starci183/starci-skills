import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { CqrsModule as NestCqrsModule } from "@nestjs/cqrs"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./cqrs.module-definition"

@Module({})
/** Provides the command and query buses; the handlers of every feature register themselves with them. */
export class CqrsModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            imports: [...(base.imports ?? []), NestCqrsModule.forRoot()],
            exports: [NestCqrsModule],
        }
    }
}

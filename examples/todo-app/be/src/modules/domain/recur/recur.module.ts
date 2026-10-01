import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { GeneratorService } from "./generator.service"
import { OccurrenceService } from "./occurrence.service"
import { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } from "./recur.module-definition"
import { RuleService } from "./rule.service"

@Module({})
/** The recur capability: rules, occurrences and the computation of the occurrences that are due. The handlers and the tick job that orchestrate it live in the todo feature. */
export class RecurModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), RuleService, OccurrenceService, GeneratorService],
            exports: [MODULE_OPTIONS_TOKEN, RuleService, OccurrenceService, GeneratorService],
        }
    }
}

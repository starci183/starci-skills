/** Recur module for the recur.module flow - one named step of the recur capability's behaviour. */
import {
    DynamicModule, Module 
} from "@nestjs/common"
import {
    CqrsModule 
} from "@nestjs/cqrs"
import {
    ScheduleModule 
} from "@nestjs/schedule"
import {
    WinstonService 
} from "@modules/platform/logging/winston.service"
import {
    ConfigurableModuleClass, OPTIONS_TYPE 
} from "./recur.module-definition"
import {
    RuleService 
} from "./rule.service"
import {
    OccurrenceService 
} from "./occurrence.service"
import {
    GeneratorService 
} from "./generator.service"
import {
    SchedulerService 
} from "./scheduler.service"
import {
    MakeRecurringHandler 
} from "./make-recurring.handler"
import {
    EditRecurrenceHandler 
} from "./edit-recurrence.handler"
import {
    EndRecurrenceHandler 
} from "./end-recurrence.handler"
import {
    CompleteOccurrenceHandler 
} from "./complete-occurrence.handler"
import {
    SkipOccurrenceHandler 
} from "./skip-occurrence.handler"
import {
    UpcomingOccurrencesHandler 
} from "./upcoming-occurrences.handler"

/**
 * The `recur` capability module, under nivo's `modules/bussiness/<capability>` shape - owns RuleService,
 * OccurrenceService, GeneratorService (sds.recur.generation-engine / sds.recur.occurrence-lifecycle) and
 * every recur CQRS command/query handler. `SchedulerService` (integration.recur.scheduler) is provided
 * here too: `ScheduleModule.forRoot()` is imported in this module's own `imports`, not from
 * `app.module.ts`, because this is the one feature in this example that needs a cron tick at all.
 *
 * `CreateTaskCommand` (from `@modules/bussiness/task`) is dispatched through the shared, app-wide
 * `CommandBus` by `GeneratorService` - the brief's own seam for "an occurrence is a task created through
 * the task capability's create command" - so no import of `TaskModule` itself is needed here; the
 * `CreateTaskHandler` that actually answers that command is registered once, by `TaskModule`, in
 * `app.module.ts`.
 *
 * No `TypeOrmModule.forFeature(...)`: `RuleService`/`OccurrenceService` reach `RuleEntity`/
 * `OccurrenceEntity`/`TaskEntity` through `@InjectPrimaryEntityManager()`, exactly like every other
 * capability in this codebase.
 */
@Module({
})
/** Nest module wiring the recur capability's providers; the app composition root registers it - other modules never import it. */
export class RecurModule extends ConfigurableModuleClass {
    static register(options: typeof OPTIONS_TYPE = {
    }): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            imports: [CqrsModule,
                ScheduleModule.forRoot()],
            providers: [
                ...(base.providers ?? []),
                WinstonService,
                RuleService,
                OccurrenceService,
                GeneratorService,
                SchedulerService,
                MakeRecurringHandler,
                EditRecurrenceHandler,
                EndRecurrenceHandler,
                CompleteOccurrenceHandler,
                SkipOccurrenceHandler,
                UpcomingOccurrencesHandler,
            ],
            exports: [RuleService,
                OccurrenceService,
                GeneratorService],
        }
    }
}

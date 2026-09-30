import { OccurrenceEntity } from "./persistence/entities/occurrence.entity"
import { RuleEntity } from "./persistence/entities/rule.entity"
import { CreateRecurTables1758246000001 } from "./persistence/migrations/1758246000001-create-recur-tables"

/** The entities of the recur capability, for the connection that holds them. */
export const recurEntities = [RuleEntity, OccurrenceEntity]

/** The migrations of the recur capability, in the order they run. */
export const recurMigrations = [CreateRecurTables1758246000001]

export { addDays, datesForRule } from "./calendar.policy"
export { RECUR_ERROR_KINDS, RecurError, RecurErrorCode } from "./errors/recur.error"
export { GeneratorService } from "./generator.service"
export { RECUR_MESSAGES } from "./messages/recur.messages"
export { OccurrenceService } from "./occurrence.service"
export { parseRecurConfig } from "./recur.config"
export { RuleFrequency } from "./recur.contracts"
export type { DueOccurrence, OccurrenceView, RuleView } from "./recur.contracts"
export { InjectRecurOptions } from "./recur.decorators"
export { RecurLogEvent } from "./recur.log-events"
export { RecurModule } from "./recur.module"
export type { RecurOptions } from "./recur.options"
export { RuleService } from "./rule.service"
export { localDateInZone } from "./zone.policy"

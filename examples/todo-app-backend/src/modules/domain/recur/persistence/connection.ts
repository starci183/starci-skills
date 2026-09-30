import { PRIMARY_CONNECTION } from "@modules/platform/database"
import { OccurrenceEntity } from "./entities/occurrence.entity"
import { RuleEntity } from "./entities/rule.entity"
import { CreateRecurTables1758246000001 } from "./migrations/1758246000001-create-recur-tables"

/** The connection that holds the tables of the recur capability. */
export const CONNECTION = PRIMARY_CONNECTION

/** The entities of the recur capability, for the connection that holds them. */
export const recurEntities = [RuleEntity, OccurrenceEntity]

/** The migrations of the recur capability, in the order they run. */
export const recurMigrations = [CreateRecurTables1758246000001]

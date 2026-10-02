import { LoyaltyEntryEntity } from "./entities/loyalty-entry.entity"
import { CreateLoyaltyEntries1789800007000 } from "./migrations/1789800007000-create-loyalty-entries"

/** The entities of the loyalty capability, for the connection that holds them. */
export const loyaltyEntities = [LoyaltyEntryEntity]

/** The migrations of the loyalty capability, in the order they run. */
export const loyaltyMigrations = [CreateLoyaltyEntries1789800007000]

import { PersonEntity } from "./entities/person.entity"
import { CreatePersons1789800000000 } from "./migrations/1789800000000-create-persons"

/** The entities of the account capability, for the connection that holds them. */
export const accountEntities = [PersonEntity]

/** The migrations of the account capability, in the order they run. */
export const accountMigrations = [CreatePersons1789800000000]

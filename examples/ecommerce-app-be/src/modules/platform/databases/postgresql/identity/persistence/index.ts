import type {
    MigrationInterface 
} from "typeorm"
import {
    PersonEntity 
} from "./entities/person.entity"
import {
    CreateIdentityTables1789800000000 
} from "./migrations/1789800000000-create-identity-tables"

export { CONNECTION } from "./connection"
export { pingDatabase } from "./ping.repository"
export { PersonEntity }

/** Every entity of the identity connection, listed explicitly so what runs is what was reviewed (no glob). */
export const entities = [PersonEntity]

/** Every migration of the identity connection in the order it runs; only `apps/migrate` applies them. */
export const migrations: ReadonlyArray<new () => MigrationInterface> = [CreateIdentityTables1789800000000]

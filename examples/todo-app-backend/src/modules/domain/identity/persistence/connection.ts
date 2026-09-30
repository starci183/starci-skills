import { PRIMARY_CONNECTION } from "@modules/platform/database"
import { SessionEntity } from "./entities/session.entity"
import { CreateSessionsTable1758160000000 } from "./migrations/1758160000000-create-sessions-table"

/** The connection that holds the tables of the session capability. */
export const CONNECTION = PRIMARY_CONNECTION

/** The entities of the identity capability, for the connection that holds them. */
export const identityEntities = [SessionEntity]

/** The migrations of the identity capability, in the order they run. */
export const identityMigrations = [CreateSessionsTable1758160000000]

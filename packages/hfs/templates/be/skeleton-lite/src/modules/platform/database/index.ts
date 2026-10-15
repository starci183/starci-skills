export { DatabaseModule } from "./database.module"
export type { DatabaseConnectionOptions } from "./database.options"
export { PRIMARY_DATA_SOURCE } from "./database.port"
export { DATABASE_ERROR_KINDS } from "./errors/database.error"
export { parsePrimaryDatabaseConfig } from "./primary.config"

export { InjectPrimaryEntityManager, PRIMARY_ENTITY_MANAGER } from "./primary.decorators"

export { DATABASE_PROBE } from "./database.decorators"
export { DatabaseModule } from "./database.module"
export type {
    DatabaseConnectionConfig,
    DatabaseConnectionOptions,
    DatabaseOptions,
    EntityClass,
    MigrationClass,
} from "./database.options"
export { LIST_ROWS_MAX, PAGE_SIZE_MAX, ident, sql } from "./database.sql"
export type { SqlIdent, SqlText } from "./database.sql"
export { DATABASE_ERROR_KINDS } from "./errors/database.error"
export { parseIdentityDatabaseConfig } from "./identity.config"
export { IDENTITY_CONNECTION } from "./identity.connection"
export { InjectIdentityEntityManager } from "./identity.decorators"
export { parseOrderDatabaseConfig } from "./order.config"
export { ORDER_CONNECTION } from "./order.connection"
export { InjectOrderEntityManager } from "./order.decorators"

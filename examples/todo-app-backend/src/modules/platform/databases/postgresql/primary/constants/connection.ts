/**
 * The one named TypeORM connection this example owns. Nivo centralises every entity under
 * `@modules/databases/postgresql/primary/entities/*.entity.ts` and threads a named connection constant
 * through every `TypeOrmModule.forFeature([...], CONNECTION)` call rather than relying on TypeORM's
 * unnamed default connection. A single-database example only ever needs one name, but the constant still
 * exists so a capability module's intent ("this belongs to the primary Postgres database") is explicit
 * and a second named connection can be introduced later without touching every call site.
 */
export const POSTGRESQL_PRIMARY = 'postgresql-primary';

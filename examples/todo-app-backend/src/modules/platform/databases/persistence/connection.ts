/**
 * The one named TypeORM connection this example owns. A single-database example only needs one name, but
 * the constant still exists so a capability's intent ("this belongs to the primary Postgres database") is
 * explicit and a second named connection can be introduced later without touching every call site. The
 * value is the name declared in `hfs.json` under `connections`.
 */
export const CONNECTION = "postgresql-primary"

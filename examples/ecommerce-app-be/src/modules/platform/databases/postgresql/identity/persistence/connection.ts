/**
 * The named TypeORM connection this service's database owns: the value declared in `hfs.json` under
 * `connections`, so the migrate app, the runtime module and the injection decorator all spell it once.
 */
export const CONNECTION = "identity-postgresql"

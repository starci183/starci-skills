/**
 * integration.login.postgres and sds.login.session-store both name Postgres as the store, without
 * requiring every consumer to depend on TypeORM directly. Domain modules inject these tokens and see
 * only the row-shaped port they declare; this module is the only place that knows the port is really a
 * TypeORM Repository.
 */
export const SESSION_STORE = Symbol('SESSION_STORE');
export const TASK_STORE = Symbol('TASK_STORE');

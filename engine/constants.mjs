/**
 * `ENGINE_SCHEMA` is the durable engine's identity in workflow state: a schema, not a number, so a build
 * is named by what it is. `scripts/install/install.mjs` reads it and records it in the install manifest.
 *
 * The store schemas are deliberately NOT re-declared here: `LEDGER_SCHEMA`/`LEDGER_VERSION` and
 * `MACHINE_SCHEMA`/`MACHINE_VERSION` live in `engine/ledger-db.mjs`, beside the code that opens the files
 * they name. Import them from there.
 */
export const ENGINE_SCHEMA='starci/engine@1';
/** A workflow state is enrolled when its engine record carries this schema. */
export const isEnrolled=state=>state?.engine?.schema===ENGINE_SCHEMA;

/**
 * The constants that outlived their old modules. `ENGINE_SCHEMA` was the one live export of the retired
 * `kernel/common.mjs` — the durable engine's identity in workflow state: a schema, not a number, so a build
 * is named by what it is. The installer (`bin/starci-skills.mjs` → `scripts/install/`) consumes it.
 *
 * The store schemas are deliberately NOT re-declared here: `LEDGER_SCHEMA`/`LEDGER_VERSION` and
 * `MACHINE_SCHEMA`/`MACHINE_VERSION` live in `engine/ledger-db.mjs`, beside the code that opens the files
 * they name. Import them from there.
 */
export const ENGINE_SCHEMA='starci/engine@1';
/** A workflow state is enrolled when its engine record carries this schema. */
export const isEnrolled=state=>state?.engine?.schema===ENGINE_SCHEMA;

/**
 * data.audit.log-line as this module's own read shape. `actor` is the decrypted person id when the
 * caller's own key still exists in the keystore, or `null` when it has been destroyed by a completed
 * erasure (a tombstoned line - fr.audit.log.read's "reads as tombstoned rather than throwing"). `keyId`
 * is deliberately not a field here: fr.audit.log.read's postcondition forbids a response ever including
 * a keyId a reader could use to correlate lines across an erasure.
 */
export class AuditLogLineRecord {
  constructor(
    readonly id: string,
    readonly at: Date,
    readonly action: string,
    readonly target: string | null,
    readonly actor: string | null,
    readonly tombstoned: boolean,
  ) {}
}

import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * data.audit.log-line: one append-only, hash-chained row per tracked action. `id` is the chain's own
 * ordering key (a bigserial, never reused, never reordered) - sds.audit.log-chain and
 * ac.audit.append-only.chain-detects-tamper both need a stable position independent of `at`, since two
 * lines can share a capture timestamp but never a chain position. `actor` carries the acting person's id
 * sealed under `keyId`'s key (AES-256-GCM); it is unreadable once that key is destroyed by an erasure,
 * and is never re-sealed or removed - only the keystore row that would resolve `keyId` back to a key
 * disappears (see AuditKeyEntity). `prevHash`/`hash` are exactly the fields
 * ac.audit.append-only.chain-detects-tamper recomputes; nothing here is ever updated after insert.
 */
@Entity({ name: 'audit_log_lines' })
export class AuditLogLineEntity {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Column('timestamptz')
  at!: Date;

  @Column('text')
  action!: string;

  @Column('text', { nullable: true })
  target!: string | null;

  @Column('text', { name: 'key_id' })
  keyId!: string;

  @Column('text')
  actor!: string;

  @Column('text', { name: 'prev_hash' })
  prevHash!: string;

  @Column('text')
  hash!: string;
}

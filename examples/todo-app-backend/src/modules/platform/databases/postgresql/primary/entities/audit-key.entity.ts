import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * decision.audit.erasure-method (crypto-shred): the keystore that AuditKeyEntity's row is. `personId` is
 * the primary key so a lookup by subject is one row read; `keyId` is opaque (not derived from and not
 * equal to `personId`) and is the only value a log line ever carries. Erasure deletes this row outright
 * (destroying the key and the personId-to-keyId mapping together, in one statement) - it never edits a
 * log line. Once the row is gone, `keyId` on every line that person produced points at nothing: `actor`
 * stays exactly as sealed, forever unreadable, without the log's own bytes or hash chain ever changing.
 */
@Entity({ name: 'audit_keys' })
export class AuditKeyEntity {
  @PrimaryColumn('text', { name: 'person_id' })
  personId!: string;

  @Column('text', { name: 'key_id', unique: true })
  keyId!: string;

  @Column('text')
  key!: string;

  @Column('timestamptz', { name: 'created_at' })
  createdAt!: Date;
}

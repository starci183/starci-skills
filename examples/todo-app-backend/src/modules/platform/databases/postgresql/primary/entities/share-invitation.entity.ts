import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * data.share.invitation: one row per (taskId, email) pair at a time. status is written directly for
 * accept and revoke, and computed at read time for expiry (InvitationService re-derives and persists it
 * lazily - never a background sweep). personId is null until the invited person accepts; once bound it is
 * the seam ShareCompletionAuthority consults to answer mayComplete for that (taskId, personId) pair
 * without a further database round trip (see collaborator-cache.ts), and revoke clears it immediately.
 */
@Entity({ name: 'invitations' })
export class ShareInvitationEntity {
  @PrimaryColumn('text')
  id!: string;

  @Column('text', { name: 'task_id' })
  taskId!: string;

  @Column('text', { name: 'owner_id' })
  ownerId!: string;

  @Column('text')
  email!: string;

  @Column('text')
  role!: string;

  @Column('text')
  status!: string;

  @Column('timestamptz', { name: 'sent_at' })
  sentAt!: Date;

  @Column('timestamptz', { name: 'accepted_at', nullable: true })
  acceptedAt!: Date | null;

  @Column('timestamptz', { name: 'revoked_at', nullable: true })
  revokedAt!: Date | null;

  @Column('text', { name: 'person_id', nullable: true })
  personId!: string | null;
}

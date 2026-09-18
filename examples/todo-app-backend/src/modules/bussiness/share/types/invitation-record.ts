export type ShareRole = 'viewer' | 'editor';
export type ShareInvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

/** data.share.invitation as a plain record, mirroring TaskRecord/SessionRecord's own shape. */
export class InvitationRecord {
  constructor(
    readonly id: string,
    readonly taskId: string,
    readonly ownerId: string,
    readonly email: string,
    readonly role: ShareRole,
    readonly status: ShareInvitationStatus,
    readonly sentAt: Date,
    readonly acceptedAt: Date | null,
    readonly revokedAt: Date | null,
    readonly personId: string | null,
  ) {}
}

import { Injectable, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { EntityManager } from 'typeorm';
import { InjectPrimaryEntityManager, ShareInvitationEntity } from '../../platform/databases/postgresql/primary';
import { CollaboratorCache } from './collaborator-cache';
import { InvitationRecord, ShareInvitationStatus, ShareRole } from './types/invitation-record';
import {
  ShareEmailMismatchException,
  ShareForbiddenException,
  ShareInvalidEmailException,
  ShareInvalidRoleException,
  ShareInvitationAlreadyClosedException,
  ShareInvitationAlreadyExistsException,
  ShareInvitationExpiredException,
  ShareInvitationNotFoundException,
  ShareInvitationRevokedException,
} from '@modules/shared/exceptions';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EXPIRY_DAYS = 14;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const ROLES: ShareRole[] = ['viewer', 'editor'];

/**
 * sds.share.invitation-lifecycle: one row per invited email per task, its role and its status. Method
 * names mirror the record's five transitions (t-invite, t-accept, t-expire, t-revoke-pending,
 * t-revoke-accepted) so the record and the code read together, the same convention TaskService and
 * SessionService already use for their own transitions.
 *
 * Expiry and revocation are both enforced on read, never by a sweep (br.share.invite.expiry,
 * br.share.revoke.on-read): `liveStatusOf` recomputes a pending row's real status against `Date.now()`
 * every time this service reads it, and `reconcileLiveStatus` persists that recomputation the moment it
 * changes anything - the same "expire while reading" shape SessionService.findActive already uses for
 * session rows.
 */
@Injectable()
export class InvitationService implements OnModuleInit {
  constructor(
    @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
    private readonly cache: CollaboratorCache,
  ) {}

  /** Hydrates the synchronous CollaboratorCache from Postgres at boot, so a process restart does not
   * lose what accept/revoke already wrote to disk (see collaborator-cache.ts's comment). */
  async onModuleInit(): Promise<void> {
    const accepted = await this.entityManager.findBy(ShareInvitationEntity, { status: 'accepted' });
    for (const row of accepted) {
      if (row.personId) {
        this.cache.set(row.taskId, row.personId, row.role as ShareRole);
      }
    }
  }

  /** t-invite: fr.share.invite. Reuses an existing expired/revoked row for the same (taskId, email) pair
   * instead of inserting a second one, honouring data.share.invitation's "exactly one row at a time"
   * invariant; a still-pending or still-accepted row for the same pair is refused instead. */
  async invite(ownerId: string, taskId: string, email: string, role: string): Promise<InvitationRecord> {
    const normalizedEmail = normalizeEmail(email);
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      throw new ShareInvalidEmailException({ email });
    }
    if (!ROLES.includes(role as ShareRole)) {
      throw new ShareInvalidRoleException({ role });
    }

    const existing = await this.entityManager.findOneBy(ShareInvitationEntity, { taskId, email: normalizedEmail });
    if (existing) {
      const liveStatus = this.liveStatusOf(existing);
      if (liveStatus === 'pending' || liveStatus === 'accepted') {
        throw new ShareInvitationAlreadyExistsException({ taskId, email: normalizedEmail });
      }
      existing.role = role;
      existing.status = 'pending';
      existing.sentAt = new Date();
      existing.acceptedAt = null;
      existing.revokedAt = null;
      if (existing.personId) {
        this.cache.delete(existing.taskId, existing.personId);
      }
      existing.personId = null;
      const saved = await this.entityManager.save(ShareInvitationEntity, existing);
      return toRecord(saved);
    }

    const saved = await this.entityManager.save(ShareInvitationEntity, {
      id: randomUUID(),
      taskId,
      ownerId,
      email: normalizedEmail,
      role,
      status: 'pending',
      sentAt: new Date(),
      acceptedAt: null,
      revokedAt: null,
      personId: null,
    });
    return toRecord(saved);
  }

  /** t-accept / t-expire (read-after-ttl): fr.share.accept. `email` is the accepting actor's own address,
   * self-declared the same way sign-in's own email input is (see sign-in.command.ts) - the session
   * contract (contract.login.identity-for-task) resolves only {personId}, never an email, so this is the
   * one piece InvitationService cannot learn from the session seam alone; matching it against the
   * invitation's own recorded email is what actually authorizes binding personId to this row. */
  async accept(actorId: string, invitationId: string, email: string): Promise<InvitationRecord> {
    const row = await this.findRow(invitationId);
    const normalizedEmail = normalizeEmail(email);
    if (normalizedEmail !== row.email) {
      throw new ShareEmailMismatchException({ invitationId });
    }

    const liveStatus = await this.reconcileLiveStatus(row);
    if (liveStatus === 'expired') {
      throw new ShareInvitationExpiredException({ invitationId });
    }
    if (liveStatus === 'revoked') {
      throw new ShareInvitationRevokedException({ invitationId });
    }
    if (liveStatus === 'accepted') {
      if (row.personId === actorId) {
        return toRecord(row);
      }
      throw new ShareInvitationAlreadyClosedException({ invitationId });
    }

    row.status = 'accepted';
    row.acceptedAt = new Date();
    row.personId = actorId;
    const saved = await this.entityManager.save(ShareInvitationEntity, row);
    this.cache.set(saved.taskId, actorId, saved.role as ShareRole);
    return toRecord(saved);
  }

  /** t-revoke-pending / t-revoke-accepted: fr.share.revoke. Only the invitation's own owner may revoke
   * it; an already expired or already revoked row refuses a second revoke. */
  async revoke(ownerId: string, invitationId: string): Promise<InvitationRecord> {
    const row = await this.findRow(invitationId);
    if (row.ownerId !== ownerId) {
      throw new ShareForbiddenException({ invitationId, actorId: ownerId });
    }

    const liveStatus = await this.reconcileLiveStatus(row);
    if (liveStatus === 'expired' || liveStatus === 'revoked') {
      throw new ShareInvitationAlreadyClosedException({ invitationId });
    }

    row.status = 'revoked';
    row.revokedAt = new Date();
    const saved = await this.entityManager.save(ShareInvitationEntity, row);
    if (saved.personId) {
      this.cache.delete(saved.taskId, saved.personId);
    }
    return toRecord(saved);
  }

  /** fr.share.list: the owner of the task's invitations, or a bound collaborator, sees every row with a
   * live status; anyone else - including a stranger asking about a task with no rows at all - sees
   * nothing, per that record's own exceptionFlow. */
  async listFor(actorId: string, taskId: string): Promise<InvitationRecord[]> {
    const rows = await this.entityManager.findBy(ShareInvitationEntity, { taskId });
    if (rows.length === 0) {
      return [];
    }
    const isOwner = rows.some(row => row.ownerId === actorId);
    const isCollaborator = rows.some(row => row.personId === actorId);
    if (!isOwner && !isCollaborator) {
      return [];
    }

    const results: InvitationRecord[] = [];
    for (const row of rows) {
      await this.reconcileLiveStatus(row);
      results.push(toRecord(row));
    }
    return results;
  }

  /** The read-time half of br.share.invite.expiry: a pending row past its fourteen-day window reads
   * (and, from `reconcileLiveStatus`, is persisted) as expired without any sweep ever running. */
  private liveStatusOf(row: ShareInvitationEntity): ShareInvitationStatus {
    if (row.status === 'pending' && Date.now() > row.sentAt.getTime() + EXPIRY_DAYS * MILLISECONDS_PER_DAY) {
      return 'expired';
    }
    return row.status as ShareInvitationStatus;
  }

  private async reconcileLiveStatus(row: ShareInvitationEntity): Promise<ShareInvitationStatus> {
    const live = this.liveStatusOf(row);
    if (live !== row.status) {
      row.status = live;
      await this.entityManager.save(ShareInvitationEntity, row);
    }
    return live;
  }

  private async findRow(id: string): Promise<ShareInvitationEntity> {
    const row = await this.entityManager.findOneBy(ShareInvitationEntity, { id });
    if (!row) {
      throw new ShareInvitationNotFoundException({ invitationId: id });
    }
    return row;
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function toRecord(row: ShareInvitationEntity): InvitationRecord {
  return new InvitationRecord(
    row.id,
    row.taskId,
    row.ownerId,
    row.email,
    row.role as ShareRole,
    row.status as ShareInvitationStatus,
    row.sentAt,
    row.acceptedAt,
    row.revokedAt,
    row.personId,
  );
}

import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from 'node:crypto';
import type { EntityManager } from 'typeorm';
import { InjectPrimaryEntityManager, AuditKeyEntity } from '../../platform/databases/postgresql/primary';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH_BYTES = 12;

/**
 * decision.audit.erasure-method (crypto-shred): the only place a `keyId` resolves back to a person's
 * key, and the only place that mapping is destroyed. A log line never carries a key itself, only the
 * opaque `keyId` AuditLogService asks this service to seal/unseal against.
 *
 * `SYSTEM_ACTOR_ID`'s key is never destroyed: it seals the two lines br.audit.erasure.logged requires
 * (erasure-requested, erasure-completed) which must never name the erased person - those lines' `actor`
 * field is this constant, sealed under a key that always exists, so a completed erasure never orphans
 * its own audit trail.
 */
export const SYSTEM_ACTOR_ID = 'system';

@Injectable()
export class AuditKeystoreService {
  constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

  /** Returns the existing key for `personId`, or mints and persists a fresh one on first use. */
  async getOrCreateKey(personId: string): Promise<{ keyId: string; key: Buffer }> {
    const existing = await this.entityManager.findOneBy(AuditKeyEntity, { personId });
    if (existing) {
      return { keyId: existing.keyId, key: Buffer.from(existing.key, 'base64') };
    }
    const keyId = randomUUID();
    const key = randomBytes(32);
    await this.entityManager.save(AuditKeyEntity, {
      personId,
      keyId,
      key: key.toString('base64'),
      createdAt: new Date(),
    });
    return { keyId, key };
  }

  /** The subject's current `keyId`, or `null` if they never produced a line or their key was destroyed. */
  async getKeyIdForPerson(personId: string): Promise<string | null> {
    const row = await this.entityManager.findOneBy(AuditKeyEntity, { personId });
    return row?.keyId ?? null;
  }

  /** The raw key material for `keyId`, or `null` once the owning row has been destroyed by an erasure. */
  async getKeyMaterial(keyId: string): Promise<Buffer | null> {
    const row = await this.entityManager.findOneBy(AuditKeyEntity, { keyId });
    return row ? Buffer.from(row.key, 'base64') : null;
  }

  /**
   * br.audit.erasure.right / fr.audit.erasure.complete: destroys the subject's key and the
   * personId-to-keyId mapping in one delete. Every line the subject produced still carries their
   * (now-orphaned) keyId; nothing about the log itself is touched.
   */
  async destroyKey(personId: string): Promise<void> {
    await this.entityManager.delete(AuditKeyEntity, { personId });
  }

  /** AES-256-GCM seal, encoded as `iv.tag.ciphertext` (each base64) so it fits in one text column. */
  seal(key: Buffer, plaintext: string): string {
    const iv = randomBytes(IV_LENGTH_BYTES);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [iv.toString('base64'), tag.toString('base64'), ciphertext.toString('base64')].join('.');
  }

  /** The inverse of `seal`. Returns `null` on any failure (wrong key, tampered ciphertext, bad shape)
   * rather than throwing, so a caller can treat "unreadable" uniformly whether the cause is a destroyed
   * key or a corrupted blob. */
  unseal(key: Buffer, sealed: string): string | null {
    try {
      const [ivPart, tagPart, ciphertextPart] = sealed.split('.');
      if (!ivPart || !tagPart || !ciphertextPart) return null;
      const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivPart, 'base64'));
      decipher.setAuthTag(Buffer.from(tagPart, 'base64'));
      const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertextPart, 'base64')), decipher.final()]);
      return plaintext.toString('utf8');
    } catch {
      return null;
    }
  }
}

import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from "node:crypto"
import { Injectable } from "@nestjs/common"
import { InjectPrimaryEntityManager, LIST_ROWS_MAX } from "@modules/platform/database"
import { In } from "typeorm"
import type { EntityManager } from "typeorm"
import type {
    DestroyKeyParams,
    FindKeyIdParams,
    FindKeyMaterialParams,
    GetOrCreateKeyParams,
    UnsealOutcome,
} from "./audit.contracts"
import { AuditKeyEntity } from "./persistence/entities/audit-key.entity"

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH_BYTES = 12
const KEY_LENGTH_BYTES = 32

@Injectable()
/**
 * The crypto-shred keystore: the only place a key id resolves back to a person key and the only place that mapping is
 * destroyed. A log line never carries a key, only the opaque key id this service resolves.
 */
export class AuditKeystoreService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The existing key of the person, or a fresh one minted and stored in the caller transaction on first use. */
    async getOrCreateKey(params: GetOrCreateKeyParams): Promise<{ keyId: string; key: Buffer }> {
        const existing = await params.manager.findOneBy(AuditKeyEntity, { personId: params.personId })
        if (existing) return { keyId: existing.keyId, key: Buffer.from(existing.key, "base64") }
        const keyId = randomUUID()
        const key = randomBytes(KEY_LENGTH_BYTES)
        await params.manager.save(AuditKeyEntity, {
            personId: params.personId,
            keyId,
            key: key.toString("base64"),
            createdAt: params.at,
        })
        return { keyId, key }
    }

    /** The current key id of the person, or null when they never produced a line or their key was destroyed. Never creates a key. */
    async getKeyIdForPerson(params: FindKeyIdParams): Promise<string | null> {
        const row = await (params.manager ?? this.entityManager).findOneBy(AuditKeyEntity, {
            personId: params.personId,
        })
        return row?.keyId ?? null
    }

    /** The key material of each key id that still exists, by key id; a destroyed key is simply absent. */
    async getKeyMaterials(params: FindKeyMaterialParams): Promise<Map<string, Buffer>> {
        if (params.keyIds.length === 0) return new Map()
        const rows = await (params.manager ?? this.entityManager).find(AuditKeyEntity, {
            where: { keyId: In([...params.keyIds]) },
            take: LIST_ROWS_MAX,
        })
        return new Map(rows.map((row) => [row.keyId, Buffer.from(row.key, "base64")]))
    }

    /**
     * Destroys the key and the person-to-key mapping in one delete. Every line the person produced keeps its now
     * orphaned key id; nothing about the log itself is touched.
     */
    async destroyKey(params: DestroyKeyParams): Promise<void> {
        await params.manager.delete(AuditKeyEntity, { personId: params.personId })
    }

    /** AES-256-GCM seal, encoded as `iv.tag.ciphertext` (each base64) so it fits in one text column. */
    seal(key: Buffer, plaintext: string): string {
        const iv = randomBytes(IV_LENGTH_BYTES)
        const cipher = createCipheriv(ALGORITHM, key, iv)
        const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
        return [iv.toString("base64"), cipher.getAuthTag().toString("base64"), ciphertext.toString("base64")].join(".")
    }

    /**
     * The inverse of `seal`. It never throws: a wrong key, a tampered ciphertext or a bad shape comes back as
     * `opened: false` with the cause, so an unreadable line reads the same whatever made it unreadable.
     */
    unseal(key: Buffer, sealed: string): UnsealOutcome {
        const [ivPart, tagPart, ciphertextPart] = sealed.split(".")
        if (!ivPart || !tagPart || !ciphertextPart) {
            return { opened: false, cause: new RangeError("sealed text is not iv.tag.ciphertext") }
        }
        try {
            const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivPart, "base64"))
            decipher.setAuthTag(Buffer.from(tagPart, "base64"))
            const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertextPart, "base64")), decipher.final()])
            return { opened: true, plaintext: plaintext.toString("utf8") }
        } catch (error) {
            return { opened: false, cause: error }
        }
    }
}

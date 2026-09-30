import { randomUUID } from "node:crypto"
import { Injectable } from "@nestjs/common"
import { InjectPrimaryEntityManager, LIST_ROWS_MAX } from "@modules/platform/database"
import { ok, refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import type { EntityManager } from "typeorm"
import { UploadErrorCode } from "./errors/upload.error"
import { UploadEntity } from "./persistence/entities/upload.entity"
import { toUploadView } from "./persistence/upload.rows"
import type {
    AdmitContentParams,
    AttachUploadParams,
    AuthorizeUploadParams,
    CreateUploadParams,
    FindUploadParams,
    ListTaskUploadsParams,
    MarkReadyParams,
    PresignedToken,
    PresignParams,
    RemoveUploadParams,
    UploadView,
} from "./upload.contracts"
import { InjectUploadOptions } from "./upload.decorators"
import type { UploadOptions } from "./upload.options"
import { signUploadToken, verifyUploadToken } from "./upload-token.policy"

type IntakeRefusal = UploadErrorCode.MimeNotAllowed | UploadErrorCode.TooLarge
type AdmitRefusal = UploadErrorCode.NotFound | UploadErrorCode.TokenInvalid | UploadErrorCode.TooLarge
type AuthorizeRefusal = UploadErrorCode.NotFound | UploadErrorCode.Forbidden

/** The one place a storage key is minted: from the upload id only, so nothing a client controls reaches the storage plane. */
const storageKeyOf = (uploadId: string): string => `uploads/${uploadId}`

@Injectable()
/**
 * The upload metadata rows and the rules on them: intake validation, the presigned content token, the owner and ready
 * guards. It never touches the bytes (the storage integration does, orchestrated by the handlers) and never reads a
 * task: attaching an upload to a task needs the task ownership decision, which the handler makes with TaskService.
 */
export class UploadService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectUploadOptions() private readonly options: UploadOptions,
    ) {}

    /** Writes a pending upload row for the owner, or refuses a media type off the allowlist or a size out of bounds. */
    async createPending(params: CreateUploadParams): Promise<Outcome<UploadView, IntakeRefusal>> {
        const refusal = this.intakeRefusal(params.mime, params.sizeBytes)
        if (refusal) return refusal
        const id = randomUUID()
        const saved = await params.manager.save(UploadEntity, {
            id,
            owner: params.ownerId,
            taskId: null,
            filename: params.filename.trim() || "file",
            mime: params.mime,
            sizeBytes: params.sizeBytes,
            storageKey: storageKeyOf(id),
            status: "pending",
            createdAt: params.at,
        })
        return ok(toUploadView(saved))
    }

    /** Mints the content token of a pending upload, valid for the configured lifetime. */
    presign(params: PresignParams): PresignedToken {
        const expiresAt = new Date(params.at.getTime() + this.options.presignTtlMs)
        const token = signUploadToken({
            uploadId: params.uploadId,
            expiresAtMs: expiresAt.getTime(),
            secret: this.options.signingSecret.reveal(),
        })
        return { token, expiresAt }
    }

    /**
     * The upload with this id, or null. An empty id is answered before any query: TypeORM drops an undefined
     * criterion from the WHERE clause, so a lookup on it would match an arbitrary row.
     */
    async find(params: FindUploadParams): Promise<UploadView | null> {
        if (!params.uploadId) return null
        const row = await this.entityManager.findOneBy(UploadEntity, { id: params.uploadId })
        return row ? toUploadView(row) : null
    }

    /**
     * Decides whether bytes may be stored for an upload: the token must verify against the row, the row must still be
     * pending (a consumed intent is refused, never overwritten), and the RECEIVED size must be inside the ceiling (a
     * client can declare a small intent and send a large body).
     */
    async admitContent(params: AdmitContentParams): Promise<Outcome<UploadView, AdmitRefusal>> {
        const upload = await this.find({ uploadId: params.uploadId })
        if (!upload) return refused(UploadErrorCode.NotFound, { uploadId: params.uploadId })
        const verdict = verifyUploadToken({
            uploadId: upload.id,
            token: params.token,
            secret: this.options.signingSecret.reveal(),
            nowMs: params.at.getTime(),
        })
        if (verdict !== "ok") return refused(UploadErrorCode.TokenInvalid, { uploadId: upload.id, reason: verdict })
        if (upload.status !== "pending") {
            return refused(UploadErrorCode.TokenInvalid, { uploadId: upload.id, reason: "status" })
        }
        return this.sizeRefusal(params.sizeBytes) ?? ok(upload)
    }

    /** The upload when the person owns it: a missing row and somebody else's row are told apart for the owner decision. */
    async authorize(params: AuthorizeUploadParams): Promise<Outcome<UploadView, AuthorizeRefusal>> {
        const upload = await this.find({ uploadId: params.uploadId })
        if (!upload) return refused(UploadErrorCode.NotFound, { uploadId: params.uploadId })
        if (upload.owner !== params.actorId) return refused(UploadErrorCode.Forbidden, { uploadId: upload.id })
        return ok(upload)
    }

    /** The upload when its bytes landed; a pending upload is not an attachment and not downloadable. */
    requireReady(upload: UploadView): Outcome<UploadView, UploadErrorCode.NotReady> {
        return upload.status === "ready" ? ok(upload) : refused(UploadErrorCode.NotReady, { uploadId: upload.id })
    }

    /** Flips a pending upload to ready with the size that landed. */
    async markReady(params: MarkReadyParams): Promise<UploadView> {
        const saved = await params.manager.save(UploadEntity, {
            ...this.rowOf(params.upload),
            sizeBytes: params.sizeBytes,
            status: "ready",
        })
        return toUploadView(saved)
    }

    /** Points an upload at a task. Attaching is metadata only: the bytes never move. */
    async attach(params: AttachUploadParams): Promise<UploadView> {
        const saved = await params.manager.save(UploadEntity, { ...this.rowOf(params.upload), taskId: params.taskId })
        return toUploadView(saved)
    }

    /** The uploads of the owner attached to a task, at most LIST_ROWS_MAX; the owner is part of the read. */
    async listForTask(params: ListTaskUploadsParams): Promise<Array<UploadView>> {
        const rows = await this.entityManager.find(UploadEntity, {
            where: { taskId: params.taskId, owner: params.ownerId },
            take: LIST_ROWS_MAX,
        })
        return rows.map(toUploadView)
    }

    /** Deletes the upload row. */
    async remove(params: RemoveUploadParams): Promise<void> {
        await params.manager.delete(UploadEntity, params.id)
    }

    /** The mime rule first, then the size rule. */
    private intakeRefusal(mime: string, sizeBytes: number): Outcome<never, IntakeRefusal> | null {
        if (!this.options.allowedMimes.includes(mime)) return refused(UploadErrorCode.MimeNotAllowed, { mime })
        return this.sizeRefusal(sizeBytes)
    }

    private sizeRefusal(sizeBytes: number): Outcome<never, UploadErrorCode.TooLarge> | null {
        const valid = Number.isInteger(sizeBytes) && sizeBytes > 0 && sizeBytes <= this.options.maxBytes
        return valid ? null : refused(UploadErrorCode.TooLarge, { sizeBytes, maxBytes: this.options.maxBytes })
    }

    private rowOf(upload: UploadView): UploadEntity {
        return {
            id: upload.id,
            owner: upload.owner,
            taskId: upload.taskId,
            filename: upload.filename,
            mime: upload.mime,
            sizeBytes: upload.sizeBytes,
            storageKey: upload.storageKey,
            status: upload.status,
            createdAt: upload.createdAt,
        }
    }
}

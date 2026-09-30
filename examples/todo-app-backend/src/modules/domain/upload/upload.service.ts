import { Injectable } from "@nestjs/common"
import { TaskService } from "@modules/domain/task"
import { UploadStorageError, InjectUploadStorage } from "@modules/integrations/upload-storage"
import type { UploadStorage } from "@modules/integrations/upload-storage"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager, LIST_ROWS_MAX } from "@modules/platform/database"
import { InjectIds } from "@modules/platform/ids"
import type { Ids } from "@modules/platform/ids"
import { ok, refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import type { EntityManager } from "typeorm"
import { UploadErrorCode } from "./errors/upload.error"
import { UploadEntity } from "./persistence/entities/upload.entity"
import { toUploadSummary, toUploadView } from "./persistence/upload.rows"
import type {
    AcceptContentParams,
    AdmitContentParams,
    AttachParams,
    CreateDirectParams,
    CreateIntentParams,
    DeletedUpload,
    ListTaskUploadsParams,
    PresignedToken,
    ReadContentParams,
    RemoveParams,
    TaskUploads,
    UploadContent,
    UploadIntent,
    UploadOutcome,
    UploadSummary,
    UploadView,
} from "./upload.contracts"
import { UPLOAD_TOKEN_HEADER } from "./upload.contracts"
import { InjectUploadOptions } from "./upload.decorators"
import type { UploadOptions } from "./upload.options"
import { signUploadToken, verifyUploadToken } from "./upload-token.policy"

/** The one place a storage key is minted: from the upload id only, so nothing a client controls reaches the storage plane. */
const storageKeyOf = (uploadId: string): string => `uploads/${uploadId}`

@Injectable()
/**
 * The uploads: the metadata rows, the intake rules, the presigned content token, the owner and ready guards, and the
 * orchestration of the byte plane. The bytes are stored and inspected outside any transaction; only then does the row
 * turn ready, so a rejected inspection leaves the row pending. Attaching to a task needs the task ownership decision,
 * which is made here with the task service.
 */
export class UploadService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectIds() private readonly ids: Ids,
        @InjectUploadOptions() private readonly options: UploadOptions,
        @InjectUploadStorage() private readonly storage: UploadStorage,
        private readonly tasks: TaskService,
    ) {}

    /**
     * Opens a pending upload for the owner after the declared media type and size pass the intake rules, and answers
     * the presigned request the client fulfils on the content door. Nothing is stored yet: the bytes come with the token.
     */
    async createIntent(params: CreateIntentParams): Promise<UploadOutcome<UploadIntent>> {
        const at = this.clock.now()
        const created = await this.openPending({ ...params, at })
        if (created.kind === "refused") return created
        const { token, expiresAt } = this.presign(created.value.id, at)
        return ok({
            uploadId: created.value.id,
            method: "PUT",
            url: `/uploads/${created.value.id}/content`,
            headers: [
                { name: UPLOAD_TOKEN_HEADER, value: token },
                { name: "content-type", value: created.value.mime },
            ],
            expiresAt,
        })
    }

    /**
     * Stores a file that arrived with the request: the pending row is written with the received size, then the storing,
     * the inspection and the ready flip run exactly as for a presigned upload, with a token minted just now.
     */
    async createDirect(params: CreateDirectParams): Promise<UploadOutcome<UploadSummary>> {
        const at = this.clock.now()
        const created = await this.openPending({
            ownerId: params.ownerId,
            filename: params.filename,
            mime: params.mime,
            sizeBytes: params.content.length,
            at,
        })
        if (created.kind === "refused") return created
        const { token } = this.presign(created.value.id, at)
        return this.acceptContent({ uploadId: created.value.id, token, content: params.content })
    }

    /**
     * The presigned data plane: stores the bytes of a pending upload when its token verifies. The token, the pending
     * state and the RECEIVED size are decided first; a rejected inspection leaves the row pending.
     */
    async acceptContent(params: AcceptContentParams): Promise<UploadOutcome<UploadSummary>> {
        const { uploadId, content } = params
        const admitted = await this.admitContent({
            uploadId,
            token: params.token,
            sizeBytes: content.length,
            at: this.clock.now(),
        })
        if (admitted.kind === "refused") return admitted
        const stored = await this.viaStorage(uploadId, () => this.storage.store({ uploadId, content }))
        if (stored.kind === "refused") return stored
        if (!stored.value.accepted)
            return refused(UploadErrorCode.ScanRejected, { uploadId, reason: stored.value.reason })
        const ready = await this.entityManager.transaction((manager) =>
            manager.save(UploadEntity, { ...this.rowOf(admitted.value), sizeBytes: content.length, status: "ready" }),
        )
        return ok(toUploadSummary(toUploadView(ready)))
    }

    /** Attaches a ready upload of the actor to a task of the actor. Attaching is metadata only: the bytes never move. */
    async attach(params: AttachParams): Promise<UploadOutcome<UploadSummary>> {
        const authorized = await this.authorize(params.uploadId, params.actorId)
        if (authorized.kind === "refused") return authorized
        const ready = this.requireReady(authorized.value)
        if (ready.kind === "refused") return ready
        const task = await this.tasks.find({ id: params.taskId })
        if (!task) return refused(UploadErrorCode.NotFound, { taskId: params.taskId })
        if (task.owner !== params.actorId) return refused(UploadErrorCode.Forbidden, { taskId: task.id })
        const attached = await this.entityManager.transaction((manager) =>
            manager.save(UploadEntity, { ...this.rowOf(ready.value), taskId: task.id }),
        )
        return ok(toUploadSummary(toUploadView(attached)))
    }

    /**
     * Deletes an upload of the actor. The stored bytes go first, outside any transaction, and a failure of the storage
     * refuses before the row goes, so a surviving object never outlives the metadata that names it.
     */
    async remove(params: RemoveParams): Promise<UploadOutcome<DeletedUpload>> {
        const authorized = await this.authorize(params.uploadId, params.actorId)
        if (authorized.kind === "refused") return authorized
        const uploadId = authorized.value.id
        const deleted = await this.viaStorage(uploadId, () => this.storage.delete({ uploadId }))
        if (deleted.kind === "refused") return deleted
        await this.entityManager.transaction((manager) => manager.delete(UploadEntity, uploadId))
        return ok({ uploadId, deleted: true })
    }

    /**
     * Lists the uploads attached to a task, for the owner of the task only: the task ownership decision precedes the
     * listing, so a stranger learns nothing about the attachments, and the read itself is bound to the owner.
     */
    async listForTask(params: ListTaskUploadsParams): Promise<UploadOutcome<TaskUploads>> {
        const task = await this.tasks.find({ id: params.taskId })
        if (!task) return refused(UploadErrorCode.NotFound, { taskId: params.taskId })
        if (task.owner !== params.actorId) return refused(UploadErrorCode.Forbidden, { taskId: task.id })
        const rows = await this.entityManager.find(UploadEntity, {
            where: { taskId: task.id, owner: params.actorId },
            take: LIST_ROWS_MAX,
        })
        return ok({ uploads: rows.map((row) => toUploadSummary(toUploadView(row))) })
    }

    /**
     * Reads the bytes of a ready upload for its owner. A ready row whose object vanished from storage answers not found:
     * metadata without bytes is not downloadable, and the refusal has the shape a never-existing id gets.
     */
    async readContent(params: ReadContentParams): Promise<UploadOutcome<UploadContent>> {
        const authorized = await this.authorize(params.uploadId, params.actorId)
        if (authorized.kind === "refused") return authorized
        const ready = this.requireReady(authorized.value)
        if (ready.kind === "refused") return ready
        const uploadId = ready.value.id
        const read = await this.viaStorage(uploadId, () => this.storage.get({ uploadId }))
        if (read.kind === "refused") return read
        if (read.value === null) return refused(UploadErrorCode.NotFound, { uploadId, reason: "object-missing" })
        return ok({ filename: ready.value.filename, mime: ready.value.mime, content: read.value })
    }

    /** Writes a pending upload row for the owner, or refuses a media type off the allowlist or a size out of bounds. */
    private async openPending(
        params: CreateIntentParams & { readonly at: Date },
    ): Promise<Outcome<UploadView, UploadErrorCode.MimeNotAllowed | UploadErrorCode.TooLarge>> {
        if (!this.options.allowedMimes.includes(params.mime))
            return refused(UploadErrorCode.MimeNotAllowed, { mime: params.mime })
        const oversize = this.sizeRefusal(params.sizeBytes)
        if (oversize) return oversize
        const id = this.ids.next()
        const saved = await this.entityManager.transaction((manager) =>
            manager.save(UploadEntity, {
                id,
                owner: params.ownerId,
                taskId: null,
                filename: params.filename.trim() || "file",
                mime: params.mime,
                sizeBytes: params.sizeBytes,
                storageKey: storageKeyOf(id),
                status: "pending",
                createdAt: params.at,
            }),
        )
        return ok(toUploadView(saved))
    }

    /** Mints the content token of a pending upload, valid for the configured lifetime. */
    private presign(uploadId: string, at: Date): PresignedToken {
        const expiresAt = new Date(at.getTime() + this.options.presignTtlMs)
        const token = signUploadToken({
            uploadId,
            expiresAtMs: expiresAt.getTime(),
            secret: this.options.signingSecret.reveal(),
        })
        return { token, expiresAt }
    }

    /**
     * The upload with this id, or null. An empty id is answered before any query: TypeORM drops an undefined
     * criterion from the WHERE clause, so a lookup on it would match an arbitrary row.
     */
    private async find(uploadId: string): Promise<UploadView | null> {
        if (!uploadId) return null
        const row = await this.entityManager.findOneBy(UploadEntity, { id: uploadId })
        return row ? toUploadView(row) : null
    }

    /**
     * Decides whether bytes may be stored for an upload: the token must verify against the row, the row must still be
     * pending (a consumed intent is refused, never overwritten), and the RECEIVED size must be inside the ceiling (a
     * client can declare a small intent and send a large body).
     */
    private async admitContent(
        params: AdmitContentParams,
    ): Promise<
        Outcome<UploadView, UploadErrorCode.NotFound | UploadErrorCode.TokenInvalid | UploadErrorCode.TooLarge>
    > {
        const upload = await this.find(params.uploadId)
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
    private async authorize(
        uploadId: string,
        actorId: string,
    ): Promise<Outcome<UploadView, UploadErrorCode.NotFound | UploadErrorCode.Forbidden>> {
        const upload = await this.find(uploadId)
        if (!upload) return refused(UploadErrorCode.NotFound, { uploadId })
        if (upload.owner !== actorId) return refused(UploadErrorCode.Forbidden, { uploadId: upload.id })
        return ok(upload)
    }

    /** The upload when its bytes landed; a pending upload is not an attachment and not downloadable. */
    private requireReady(upload: UploadView): Outcome<UploadView, UploadErrorCode.NotReady> {
        return upload.status === "ready" ? ok(upload) : refused(UploadErrorCode.NotReady, { uploadId: upload.id })
    }

    private sizeRefusal(sizeBytes: number): Outcome<never, UploadErrorCode.TooLarge> | null {
        const valid = Number.isInteger(sizeBytes) && sizeBytes > 0 && sizeBytes <= this.options.maxBytes
        return valid ? null : refused(UploadErrorCode.TooLarge, { sizeBytes, maxBytes: this.options.maxBytes })
    }

    /** Runs one call of the byte plane: a failure of the storage integration is a refusal, any other failure is a bug and is rethrown. */
    private async viaStorage<Value>(
        uploadId: string,
        call: () => Promise<Value>,
    ): Promise<Outcome<Value, UploadErrorCode.StorageUnavailable>> {
        try {
            return ok(await call())
        } catch (error) {
            if (error instanceof UploadStorageError) return refused(UploadErrorCode.StorageUnavailable, { uploadId })
            throw error
        }
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

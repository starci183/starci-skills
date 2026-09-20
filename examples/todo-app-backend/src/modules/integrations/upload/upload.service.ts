import {
    Injectable 
} from "@nestjs/common"
import {
    randomUUID 
} from "node:crypto"
import type {
    EntityManager 
} from "typeorm"
import {
    AppConfigService 
} from "@modules/platform/config/app-config.service"
import {
    InjectPrimaryEntityManager 
} from "@modules/platform/databases/postgresql/primary/primary.decorators"
import {
    TaskEntity 
} from "@modules/platform/databases/postgresql/primary/entities/task.entity"
import {
    UploadEntity 
} from "@modules/platform/databases/postgresql/primary/entities/upload.entity"
import {
    TaskForbiddenException 
} from "@modules/shared/exceptions/errors/task/task-forbidden"
import {
    TaskNotFoundException 
} from "@modules/shared/exceptions/errors/task/task-not-found"
import {
    UploadForbiddenException 
} from "@modules/shared/exceptions/errors/upload/upload-forbidden"
import {
    UploadMimeNotAllowedException 
} from "@modules/shared/exceptions/errors/upload/upload-mime-not-allowed"
import {
    UploadNotFoundException 
} from "@modules/shared/exceptions/errors/upload/upload-not-found"
import {
    UploadNotReadyException 
} from "@modules/shared/exceptions/errors/upload/upload-not-ready"
import {
    UploadTokenInvalidException 
} from "@modules/shared/exceptions/errors/upload/upload-token-invalid"
import {
    UploadTooLargeException 
} from "@modules/shared/exceptions/errors/upload/upload-too-large"
import {
    PresignedUpload, UploadRecord, UploadStoragePort, VirusScanPort 
} from "./upload.contracts"
import {
    signUploadToken, UPLOAD_TOKEN_HEADER, verifyUploadToken 
} from "./upload-token"


/**
 * integration.upload.local: the upload capability's orchestration - intents, content acceptance,
 * attach, read and delete - over one metadata row per object (data.upload.upload via UploadEntity)
 * plus the byte plane behind UploadStoragePort.
 *
 * Two intake shapes share one validation path: `createIntent` answers a presigned descriptor the
 * client PUTs bytes to (the local adapter's door is this api's own `PUT /uploads/<id>/content` with
 * the HMAC token in `x-upload-token`; an S3 adapter would mint a provider URL at the same seam) and
 * `createDirect` stores bytes that arrived with the request itself. Either way the row starts
 * `pending`, content lands under the minted `uploads/<id>` storage key, the scan port votes, and only
 * then does the row become `ready` - the only status attach/read honour. Ownership checks mirror
 * task's: the uploader owns the row forever; attaching additionally requires owning the target task,
 * checked through TaskEntity the same way TaskService does.
 */
@Injectable()
/** Injectable service owning the upload logic the upload integration exposes; wired by the capability's own module. */
export class UploadService {
    constructor(
    @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
    private readonly storage: UploadStoragePort,
    private readonly scanner: VirusScanPort,
    private readonly config: AppConfigService,
    ) {}

    /** Opens an upload intent: validates the declared shape, writes the pending row and returns the
   * presigned PUT contract the client fulfils against acceptContent. */
    async createIntent(owner: string, filename: string, mime: string, sizeBytes: number): Promise<PresignedUpload> {
        this.assertIntakeAllowed(mime,
            sizeBytes)
        const row = await this.entityManager.save(UploadEntity,
            {
                id: randomUUID(),
                owner,
                taskId: null,
                filename: filename.trim() || "file",
                mime,
                sizeBytes,
                storageKey: "",
                status: "pending",
                createdAt: new Date(),
            })
        row.storageKey = storageKeyOf(row.id)
        await this.entityManager.save(UploadEntity,
            row)
        const expiresAt = new Date(Date.now() + this.config.getUploadPresignTtlMs())
        return {
            uploadId: row.id,
            method: "PUT",
            url: `/uploads/${row.id}/content`,
            headers: {
                [UPLOAD_TOKEN_HEADER]: signUploadToken(row.id,
                    expiresAt.getTime(),
                    this.config.getUploadSigningSecret()),
                "content-type": mime,
            },
            expiresAt,
        }
    }

    /** The presigned data plane: verifies the token against the row, enforces the same size cap a
   * second time (a client can declare a small intent and PUT a large body - the received bytes are
   * what count), stores, scans and flips the row to ready. */
    async acceptContent(uploadId: string, token: string | undefined, content: Buffer): Promise<UploadRecord> {
        const row = await this.findRow(uploadId)
        const verdict = verifyUploadToken(uploadId,
            token,
            this.config.getUploadSigningSecret(),
            Date.now())
        if (verdict !== "ok") {
            throw new UploadTokenInvalidException({
                uploadId, reason: verdict 
            })
        }
        if (row.status !== "pending") {
            // A ready row's token must not store twice - replay is refused, not overwritten.
            throw new UploadTokenInvalidException({
                uploadId, reason: "status" 
            })
        }
        this.assertSizeAllowed(content.length)
        await this.storeAndScan(row,
            content)
        row.status = "ready"
        row.sizeBytes = content.length
        const saved = await this.entityManager.save(UploadEntity,
            row)
        return toRecord(saved)
    }

    /** The direct intake: bytes ride the request itself, so no token is involved - the caller's
   * session is the credential and the door enforces it before this service ever runs. */
    async createDirect(owner: string, filename: string, mime: string, content: Buffer): Promise<UploadRecord> {
        this.assertIntakeAllowed(mime,
            content.length)
        const row = await this.entityManager.save(UploadEntity,
            {
                id: randomUUID(),
                owner,
                taskId: null,
                filename: filename.trim() || "file",
                mime,
                sizeBytes: content.length,
                storageKey: "",
                status: "pending",
                createdAt: new Date(),
            })
        row.storageKey = storageKeyOf(row.id)
        await this.storeAndScan(row,
            content)
        row.status = "ready"
        const saved = await this.entityManager.save(UploadEntity,
            row)
        return toRecord(saved)
    }

    /** Points a ready upload at a task the caller owns. Attaching is metadata only - the bytes never
   * move - and is refused for a pending upload, because an intent nobody fulfilled is not an
   * attachment. */
    async attach(uploadId: string, taskId: string, actorId: string): Promise<UploadRecord> {
        const row = await this.findRow(uploadId)
        this.assertOwned(row,
            actorId)
        if (row.status !== "ready") {
            throw new UploadNotReadyException({
                uploadId 
            })
        }
        const task = await this.entityManager.findOneBy(TaskEntity,
            {
                id: taskId 
            })
        if (!task) {
            throw new TaskNotFoundException({
                taskId 
            })
        }
        if (task.owner !== actorId) {
            throw new TaskForbiddenException({
                taskId, actorId 
            })
        }
        row.taskId = taskId
        const saved = await this.entityManager.save(UploadEntity,
            row)
        return toRecord(saved)
    }

    /** The task's attachment list, for the owner only - a stranger learns nothing, not even that the
   * task exists (the task-ownership refusal precedes the listing). */
    async listForTask(taskId: string, actorId: string): Promise<Array<UploadRecord>> {
        const task = await this.entityManager.findOneBy(TaskEntity,
            {
                id: taskId 
            })
        if (!task) {
            throw new TaskNotFoundException({
                taskId 
            })
        }
        if (task.owner !== actorId) {
            throw new TaskForbiddenException({
                taskId, actorId 
            })
        }
        const rows = await this.entityManager.findBy(UploadEntity,
            {
                taskId 
            })
        return rows.filter(row => row.owner === actorId).map(toRecord)
    }

    /** Reads the object's bytes for its owner. A ready row whose object vanished from storage answers
   * not-found - metadata without bytes is not downloadable, and the refusal is the same shape a
   * never-existing id gets so existence alone leaks nothing about the store's internals. */
    async readContent(uploadId: string, actorId: string): Promise<{ record: UploadRecord; content: Buffer }> {
        const row = await this.findRow(uploadId)
        this.assertOwned(row,
            actorId)
        if (row.status !== "ready") {
            throw new UploadNotReadyException({
                uploadId 
            })
        }
        const content = await this.storage.get(row.storageKey)
        if (content === null) {
            throw new UploadNotFoundException({
                uploadId, reason: "object-missing" 
            })
        }
        return {
            record: toRecord(row), content 
        }
    }

    /** Deletes row and object together: the store delete is attempted first and its failure propagates
   * before the row goes, so a surviving object never outlives the metadata that names it. */
    async remove(uploadId: string, actorId: string): Promise<UploadRecord> {
        const row = await this.findRow(uploadId)
        this.assertOwned(row,
            actorId)
        await this.storage.delete(row.storageKey)
        await this.entityManager.delete(UploadEntity,
            row.id)
        return toRecord(row)
    }

    private async findRow(uploadId: string): Promise<UploadEntity> {
        if (!uploadId) {
            throw new UploadNotFoundException({
            })
        }
        const row = await this.entityManager.findOneBy(UploadEntity,
            {
                id: uploadId 
            })
        if (!row) {
            throw new UploadNotFoundException({
                uploadId 
            })
        }
        return row
    }

    private assertOwned(row: UploadEntity, actorId: string): void {
        if (row.owner !== actorId) {
            throw new UploadForbiddenException({
                uploadId: row.id, actorId 
            })
        }
    }

    /** Intake validation shared by both doors: the mime must be on the configured allowlist and the
   * size (declared at intent, received at content/direct) must sit under the configured ceiling. */
    private assertIntakeAllowed(mime: string, sizeBytes: number): void {
        if (!this.config.getUploadAllowedMimes().includes(mime)) {
            throw new UploadMimeNotAllowedException({
                mime 
            })
        }
        this.assertSizeAllowed(sizeBytes)
    }

    private assertSizeAllowed(sizeBytes: number): void {
        const maxBytes = this.config.getUploadMaxBytes()
        if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > maxBytes) {
            throw new UploadTooLargeException({
                sizeBytes, maxBytes 
            })
        }
    }

    /** The storage/scan pair every content path shares: bytes land first, the scan votes on the stored
   * object, and a rejection deletes the object before propagating so refused bytes never linger. */
    private async storeAndScan(row: UploadEntity, content: Buffer): Promise<void> {
        await this.storage.put(row.storageKey,
            content)
        try {
            await this.scanner.scan(row.storageKey,
                content)
        } catch (error) {
            await this.storage.delete(row.storageKey).catch(() => undefined)
            throw error
        }
    }
}

/** The one place a storage key is minted - from the upload id only, so nothing client-controlled ever
 * reaches the adapter's path handling. */
function storageKeyOf(uploadId: string): string {
    return `uploads/${uploadId}`
}

function toRecord(row: UploadEntity): UploadRecord {
    return new UploadRecord(row.id,
        row.owner,
        row.taskId,
        row.filename,
        row.mime,
        row.sizeBytes,
        row.storageKey,
        row.status as UploadRecord["status"],
        row.createdAt)
}

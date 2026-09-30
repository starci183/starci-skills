import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { Injectable } from "@nestjs/common"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { isRecord } from "@modules/platform/primitives"
import { UploadStorageError, UploadStorageErrorCode } from "./errors/upload-storage.error"
import type { ScanVerdict, StoreUploadParams, UploadObjectParams } from "./upload.contracts"
import { InjectUploadScan, InjectUploadStorageOptions } from "./upload.decorators"
import { UploadLogEvent } from "./upload.log-events"
import type { UploadStorageOptions } from "./upload.options"
import type { UploadScan, UploadStorage } from "./upload.port"

/** The folder of the storage root that holds every object, one flat file per upload id. */
const OBJECTS_FOLDER = "uploads"

@Injectable()
/**
 * The local filesystem storage: objects live under one configured directory, keyed by the upload id only. The path is
 * resolved and must be a direct child of the objects folder, so an id that tries to leave it (`..`, a separator) is
 * refused before a byte moves. Every failure is logged once, here, and surfaces as an UploadStorageError.
 */
export class UploadClient implements UploadStorage {
    constructor(
        @InjectUploadStorageOptions() private readonly options: UploadStorageOptions,
        @InjectUploadScan() private readonly scanner: UploadScan,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** Writes the object, has it inspected, and removes it again when the inspection rejects it. */
    async store(params: StoreUploadParams): Promise<ScanVerdict> {
        const path = this.pathOf(params.uploadId)
        try {
            await mkdir(dirname(path), { recursive: true })
            await writeFile(path, params.content)
        } catch (cause) {
            throw this.failure(cause, params.uploadId)
        }
        const verdict = await this.scanner.scan({ uploadId: params.uploadId, content: params.content })
        if (!verdict.accepted) {
            // Cleanup of refused bytes never masks the verdict; `delete` has already logged if it failed.
            await Promise.allSettled([this.delete({ uploadId: params.uploadId })])
        }
        return verdict
    }

    /** Reads the object, or null when nothing is stored for the upload. */
    async get(params: UploadObjectParams): Promise<Buffer | null> {
        const path = this.pathOf(params.uploadId)
        try {
            return await readFile(path)
        } catch (cause) {
            if (isRecord(cause) && cause.code === "ENOENT") return null
            throw this.failure(cause, params.uploadId)
        }
    }

    /** Removes the object; a missing object is not a failure. */
    async delete(params: UploadObjectParams): Promise<void> {
        const path = this.pathOf(params.uploadId)
        try {
            await rm(path, { force: true })
        } catch (cause) {
            throw this.failure(cause, params.uploadId)
        }
    }

    private pathOf(uploadId: string): string {
        const folder = join(resolve(this.options.directory), OBJECTS_FOLDER)
        const path = resolve(join(folder, uploadId))
        if (dirname(path) !== folder) {
            this.logger.warn(UploadLogEvent.StorageFailed, { uploadId, reason: "id-leaves-root" })
            throw new UploadStorageError({ code: UploadStorageErrorCode.Failed, params: { reason: "id-leaves-root" } })
        }
        return path
    }

    private failure(cause: unknown, uploadId: string): UploadStorageError {
        this.logger.error(UploadLogEvent.StorageFailed, cause, { uploadId })
        return new UploadStorageError({ code: UploadStorageErrorCode.Failed, cause })
    }
}

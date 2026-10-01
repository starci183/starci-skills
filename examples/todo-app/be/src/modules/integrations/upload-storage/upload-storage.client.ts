import { Injectable } from "@nestjs/common"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { HttpError, HttpErrorCode, InjectHttpClient } from "@modules/platform/http"
import type { HttpClient } from "@modules/platform/http"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { UploadStorageError, UploadStorageErrorCode } from "./errors/upload-storage.error"
import type { ScanVerdict, StoredBytesResult, StoreUploadParams, UploadObjectParams } from "./upload-storage.contracts"
import { InjectUploadScan, InjectUploadStorageOptions } from "./upload-storage.decorators"
import { UploadLogEvent } from "./upload-storage.log-events"
import type { UploadStorageOptions } from "./upload-storage.options"
import type { UploadScan, UploadStorage } from "./upload-storage.port"
import { signS3Request } from "./upload-storage-signature.policy"

type Answer = Awaited<ReturnType<HttpClient["request"]>>

/** The key prefix of every object: `uploads/<id>`, as the upload row's storageKey says. */
const OBJECTS_PREFIX = "uploads"

/** An upload id is one key segment: letters, digits, dot, dash, underscore; never `.` or `..`. */
const KEY_SEGMENT = /^(?!\.{1,2}$)[\w.-]+$/

const EMPTY = Buffer.alloc(0)

const HTTP_OK = 200
const HTTP_NO_CONTENT = 204
const HTTP_NOT_FOUND = 404
const HTTP_CONFLICT = 409

const succeeded = (status: number): boolean => status >= HTTP_OK && status < 300

@Injectable()
/**
 * The upload storage over S3 (MinIO in the stack), spoken to through the outbound HTTP port with AWS Signature Version 4:
 * objects live at `<bucket>/uploads/<id>`, path-style. The bucket is created on the first write that finds it missing. Every
 * failure of the storage (an unreachable endpoint, a deadline, a refusal) is the declared storage failure, logged once.
 */
export class UploadClient implements UploadStorage {
    constructor(
        @InjectUploadStorageOptions() private readonly options: UploadStorageOptions,
        @InjectUploadScan() private readonly scanner: UploadScan,
        @InjectHttpClient() private readonly http: HttpClient,
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** Stores the bytes, then scans them; refused bytes are deleted again and the verdict is answered. */
    async store(params: StoreUploadParams): Promise<ScanVerdict> {
        const key = this.keyOf(params.uploadId)
        let written = await this.call("PUT", key, params.content, params.uploadId)
        if (written.status === HTTP_NOT_FOUND) {
            await this.createBucket(params.uploadId)
            written = await this.call("PUT", key, params.content, params.uploadId)
        }
        if (!succeeded(written.status)) throw this.failure(`http-${written.status}`, params.uploadId)
        const verdict = await this.scanner.scan({ uploadId: params.uploadId, content: params.content })
        if (!verdict.accepted) {
            // Cleanup of refused bytes never masks the verdict; `delete` has already logged if it failed.
            await Promise.allSettled([this.delete({ uploadId: params.uploadId })])
        }
        return verdict
    }

    /** The stored bytes, or null when the object (or its bucket) does not exist. */
    async get(params: UploadObjectParams): Promise<StoredBytesResult> {
        const answer = await this.call("GET", this.keyOf(params.uploadId), EMPTY, params.uploadId)
        if (answer.status === HTTP_NOT_FOUND) return null
        if (answer.status !== HTTP_OK || !Buffer.isBuffer(answer.body))
            throw this.failure(`http-${answer.status}`, params.uploadId)
        return answer.body
    }

    /** Deletes the object; an object that is already gone is deleted. */
    async delete(params: UploadObjectParams): Promise<void> {
        const answer = await this.call("DELETE", this.keyOf(params.uploadId), EMPTY, params.uploadId)
        if (answer.status !== HTTP_NO_CONTENT && answer.status !== HTTP_NOT_FOUND && !succeeded(answer.status)) {
            throw this.failure(`http-${answer.status}`, params.uploadId)
        }
    }

    private keyOf(uploadId: string): string {
        if (!KEY_SEGMENT.test(uploadId)) {
            this.logger.warn(UploadLogEvent.StorageFailed, { uploadId, reason: "id-leaves-root" })
            throw new UploadStorageError({ code: UploadStorageErrorCode.Failed, params: { reason: "id-leaves-root" } })
        }
        return `${OBJECTS_PREFIX}/${uploadId}`
    }

    private async createBucket(uploadId: string): Promise<void> {
        const created = await this.call("PUT", null, EMPTY, uploadId)
        if (!succeeded(created.status) && created.status !== HTTP_CONFLICT)
            throw this.failure(`http-${created.status}`, uploadId)
    }

    /** One signed request to the bucket (`key` null) or to one object of it. */
    private async call(
        method: "GET" | "PUT" | "DELETE",
        key: string | null,
        payload: Buffer,
        uploadId: string,
    ): Promise<Answer> {
        const endpoint = this.options.endpoint.replace(/\/+$/, "")
        const url = key === null ? `${endpoint}/${this.options.bucket}` : `${endpoint}/${this.options.bucket}/${key}`
        const headers = signS3Request({
            method,
            url,
            payload,
            at: this.clock.now(),
            region: this.options.region,
            accessKeyId: this.options.accessKeyId,
            secretAccessKey: this.options.secretAccessKey.reveal(),
        })
        try {
            return await this.http.request({
                method,
                url,
                headers,
                ...(method === "PUT" && key !== null ? { bytes: payload } : {}),
                read: "bytes",
                timeoutMs: this.options.timeoutMs,
            })
        } catch (cause) {
            const reason =
                cause instanceof HttpError && cause.code === HttpErrorCode.Timeout ? "timeout" : "unreachable"
            throw this.failure(reason, uploadId, cause)
        }
    }

    private failure(reason: string, uploadId: string, cause?: unknown): UploadStorageError {
        this.logger.error(UploadLogEvent.StorageFailed, cause ?? reason, { uploadId, reason })
        return new UploadStorageError({ code: UploadStorageErrorCode.Failed, params: { reason }, cause })
    }
}

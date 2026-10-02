import { Injectable } from "@nestjs/common"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { HttpError, HttpErrorCode, InjectHttpClient } from "@modules/platform/http"
import type { HttpClient } from "@modules/platform/http"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ReceiptStorageError, ReceiptStorageErrorCode } from "./errors/receipt-storage.error"
import type { RunKey } from "@modules/platform/jobs"
import type { ReceiptLink, StoreReceiptParams } from "./receipt-storage.contracts"
import { InjectReceiptStorageOptions } from "./receipt-storage.decorators"
import { ReceiptStorageLogEvent } from "./receipt-storage.log-events"
import type { ReceiptStorageOptions } from "./receipt-storage.options"
import type { ReceiptStorage } from "./receipt-storage.port"
import { presignS3Get, signS3Request } from "./receipt-storage-signature.policy"

type Answer = Awaited<ReturnType<HttpClient["request"]>>

const EMPTY = Buffer.alloc(0)
const MILLISECONDS_PER_SECOND = 1000
const HTTP_NOT_FOUND = 404
const HTTP_CONFLICT = 409

const succeeded = (status: number): boolean => status >= 200 && status < 300

@Injectable()
/**
 * The receipt archive over S3 (MinIO in the stack), spoken to through the outbound HTTP port with AWS Signature Version 4.
 * Receipts live in a private bucket, path-style; the bucket is created on the first write that finds it missing. A buyer
 * downloads a receipt only through a presigned link that expires. Every failure of a write is the declared
 * storage-unavailable error, logged once.
 */
export class S3ReceiptStorageClient implements ReceiptStorage {
    constructor(
        @InjectReceiptStorageOptions() private readonly options: ReceiptStorageOptions,
        @InjectHttpClient() private readonly http: HttpClient,
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** Stores the receipt document under its key (a repeat replaces it with the same bytes), creating the bucket on the first write. */
    async store(params: StoreReceiptParams, runKey: RunKey): Promise<void> {
        let written = await this.put(this.objectUrl(params.key), params.content, params.key)
        if (written.status === HTTP_NOT_FOUND) {
            const created = await this.put(this.bucketUrl(), EMPTY, params.key)
            if (!succeeded(created.status) && created.status !== HTTP_CONFLICT)
                throw this.failure(`http-${created.status}`, params.key)
            written = await this.put(this.objectUrl(params.key), params.content, params.key)
        }
        if (!succeeded(written.status)) throw this.failure(`http-${written.status}`, params.key)
        this.logger.info(ReceiptStorageLogEvent.Stored, { key: params.key, runKey })
    }

    /** A presigned GET of the receipt, valid for the configured lifetime from now. */
    linkOf(key: string): ReceiptLink {
        const at = this.clock.now()
        const url = presignS3Get({
            url: this.objectUrl(key),
            at,
            expiresInSeconds: Math.round(this.options.linkTtlMs / MILLISECONDS_PER_SECOND),
            region: this.options.region,
            accessKeyId: this.options.accessKeyId,
            secretAccessKey: this.options.secretAccessKey.reveal(),
        })
        return { url, expiresAt: new Date(at.getTime() + this.options.linkTtlMs) }
    }

    private bucketUrl(): string {
        let endpoint = this.options.endpoint
        while (endpoint.endsWith("/")) endpoint = endpoint.slice(0, -1)
        return `${endpoint}/${this.options.bucket}`
    }

    private objectUrl(key: string): string {
        return `${this.bucketUrl()}/${key}`
    }

    private async put(url: string, content: Buffer, key: string): Promise<Answer> {
        const headers = signS3Request({
            method: "PUT",
            url,
            payload: content,
            at: this.clock.now(),
            region: this.options.region,
            accessKeyId: this.options.accessKeyId,
            secretAccessKey: this.options.secretAccessKey.reveal(),
        })
        try {
            return await this.http.request({
                method: "PUT",
                url,
                headers: content.length > 0 ? { ...headers, "content-type": "application/json" } : headers,
                ...(content.length > 0 ? { bytes: content } : {}),
                read: "bytes",
                timeoutMs: this.options.timeoutMs,
            })
        } catch (cause) {
            const reason =
                cause instanceof HttpError && cause.code === HttpErrorCode.Timeout ? "timeout" : "unreachable"
            throw this.failure(reason, key, cause)
        }
    }

    private failure(reason: string, key: string, cause?: unknown): ReceiptStorageError {
        this.logger.error(ReceiptStorageLogEvent.StoreFailed, cause ?? reason, { key, reason })
        return new ReceiptStorageError({ code: ReceiptStorageErrorCode.Unavailable, params: { reason }, cause })
    }
}

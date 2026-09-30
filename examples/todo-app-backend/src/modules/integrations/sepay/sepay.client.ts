import { Injectable } from "@nestjs/common"
import { HttpError, HttpErrorCode, InjectHttpClient } from "@modules/platform/http"
import type { HttpClient } from "@modules/platform/http"
import { isRecord } from "@modules/platform/primitives"
import { SepayError, SepayErrorCode } from "./errors/sepay.error"
import type {
    SepayCreateIntentParams,
    SepayCreateIntentResult,
    SepayOperation,
    SepayTransaction,
    SepayTransactionStatus,
} from "./sepay.contracts"
import { InjectSepayOptions } from "./sepay.decorators"
import type { SepayOptions } from "./sepay.options"

/** The create-intent path of the gateway. */
const CREATE_INTENT_PATH = "/userapi/transactions/qr"

/** The transaction details path of the gateway; the id is appended as one encoded segment. */
const TRANSACTION_PATH = "/userapi/transactions/details/"

const isTransactionStatus = (value: unknown): value is SepayTransactionStatus =>
    value === "pending" || value === "paid" || value === "failed"

@Injectable()
/**
 * The only caller of the SePay API: SePay owns the transfer, this product owns the subscription that follows a confirmed
 * payment. Every failure is a SepayError naming the operation and a short reason; a status outside the closed vocabulary is
 * refused rather than trusted, because a reconciliation turns any status but pending or failed into an activation.
 */
export class SepayClient {
    constructor(
        @InjectHttpClient() private readonly http: HttpClient,
        @InjectSepayOptions() private readonly options: SepayOptions,
    ) {}

    /** Creates a payment intent for the subscription and returns the gateway transaction id and the checkout URL. */
    async createIntent(params: SepayCreateIntentParams): Promise<SepayCreateIntentResult> {
        const payload = await this.call("create-intent", CREATE_INTENT_PATH, "POST", {
            reference: params.subscriptionId,
            amount: params.amount,
            currency: params.currency,
        })
        const gatewayIntentId = payload.id
        const checkoutUrl = payload.qrCodeUrl
        if (typeof gatewayIntentId !== "string" || !gatewayIntentId || typeof checkoutUrl !== "string" || !checkoutUrl) {
            throw this.failure("create-intent", "missing-intent")
        }
        return { gatewayIntentId, checkoutUrl }
    }

    /** Reads the live status of one transaction, and the end of the paid period once it is paid. */
    async getTransaction(gatewayIntentId: string): Promise<SepayTransaction> {
        const payload = await this.call("get-transaction", `${TRANSACTION_PATH}${encodeURIComponent(gatewayIntentId)}`, "GET")
        const status = payload.status
        if (!isTransactionStatus(status)) throw this.failure("get-transaction", "unknown-status")
        return { status, periodEnd: this.periodEndOf(payload.periodEnd) }
    }

    private periodEndOf(value: unknown): Date | undefined {
        if (value === undefined || value === null) return undefined
        if (typeof value !== "string" && typeof value !== "number") throw this.failure("get-transaction", "bad-period-end")
        const periodEnd = new Date(value)
        if (Number.isNaN(periodEnd.getTime())) throw this.failure("get-transaction", "bad-period-end")
        return periodEnd
    }

    private async call(
        operation: SepayOperation,
        path: string,
        method: "GET" | "POST",
        body?: Readonly<Record<string, string | number>>,
    ): Promise<Readonly<Record<string, unknown>>> {
        const response = await this.send(operation, path, method, body)
        if (response.status < 200 || response.status >= 300) {
            throw this.failure(operation, `http-${response.status}`, response.status)
        }
        if (response.body === undefined) return {}
        if (!isRecord(response.body)) throw this.failure(operation, "not-an-object", response.status)
        return response.body
    }

    private async send(
        operation: SepayOperation,
        path: string,
        method: "GET" | "POST",
        body: Readonly<Record<string, string | number>> | undefined,
    ): ReturnType<HttpClient["request"]> {
        try {
            return await this.http.request({
                method,
                url: `${this.options.baseUrl}${path}`,
                headers: { accept: "application/json", authorization: `Bearer ${this.options.apiKey.reveal()}` },
                body,
                timeoutMs: this.options.timeoutMs,
            })
        } catch (cause) {
            throw this.failure(operation, this.reasonOf(cause), undefined, cause)
        }
    }

    private reasonOf(cause: unknown): string {
        if (!(cause instanceof HttpError)) return "unreachable"
        if (cause.code === HttpErrorCode.Timeout) return "timeout"
        return cause.code === HttpErrorCode.BodyUnreadable ? "not-json" : "unreachable"
    }

    private failure(operation: SepayOperation, reason: string, status?: number, cause?: unknown): SepayError {
        const params = status === undefined ? { operation, reason } : { operation, reason, status }
        return new SepayError({ code: SepayErrorCode.RequestFailed, params, cause })
    }
}

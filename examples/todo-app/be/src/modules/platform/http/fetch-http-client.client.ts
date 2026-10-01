import { Injectable } from "@nestjs/common"
import { isRecord } from "@modules/platform/primitives"
import { HttpError, HttpErrorCode } from "./errors/http.error"
import type { HttpClient, HttpRequest, HttpResponse } from "./http.port"

@Injectable()
/** The HttpClient adapter over the global `fetch`; the only place outside a spec that calls it. */
export class FetchHttpClient implements HttpClient {
    /** Sends `request` with its deadline and reads the body: parsed JSON, or the raw bytes when the request asks for them. */
    async request(request: HttpRequest): Promise<HttpResponse> {
        const deadline = AbortSignal.timeout(request.timeoutMs)
        const signal = request.signal ? AbortSignal.any([deadline, request.signal]) : deadline
        const response = await this.send(request, signal)
        if (request.read === "bytes")
            return {
                status: response.status,
                body: await this.received(response.arrayBuffer().then((bytes) => Buffer.from(bytes))),
            }
        const text = await this.received(response.text())
        return { status: response.status, body: text === "" ? undefined : this.parse(text) }
    }

    /** The body as it arrives; a deadline or a cut while it streams is the same HttpError as one before the headers. */
    private async received<T>(reading: Promise<T>): Promise<T> {
        try {
            return await reading
        } catch (cause) {
            throw this.failure(cause)
        }
    }

    private failure(cause: unknown): HttpError {
        // The deadline rejects with a DOMException from the runtime's own realm: compare its name, never its prototype chain.
        const timedOut = isRecord(cause) && cause.name === "TimeoutError"
        return new HttpError({ code: timedOut ? HttpErrorCode.Timeout : HttpErrorCode.Network, cause })
    }

    private async send(request: HttpRequest, signal: AbortSignal): Promise<Response> {
        try {
            return await fetch(request.url, {
                method: request.method,
                headers: { ...this.contentTypeOf(request), ...request.headers },
                body: this.bodyOf(request),
                signal,
            })
        } catch (cause) {
            throw this.failure(cause)
        }
    }

    private contentTypeOf(request: HttpRequest): Record<string, string> {
        if (request.form !== undefined) return { "content-type": "application/x-www-form-urlencoded" }
        if (request.bytes !== undefined) return { "content-type": "application/octet-stream" }
        return request.body === undefined ? {} : { "content-type": "application/json" }
    }

    private bodyOf(request: HttpRequest): string | Buffer | undefined {
        if (request.form !== undefined) return new URLSearchParams(request.form).toString()
        if (request.bytes !== undefined) return request.bytes
        return request.body === undefined ? undefined : JSON.stringify(request.body)
    }

    private parse(text: string): unknown {
        try {
            return JSON.parse(text)
        } catch (cause) {
            throw new HttpError({ code: HttpErrorCode.BodyUnreadable, cause })
        }
    }
}

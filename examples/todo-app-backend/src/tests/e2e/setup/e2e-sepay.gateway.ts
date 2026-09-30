import { randomUUID } from "node:crypto"
import { createServer } from "node:http"
import type { IncomingMessage, Server, ServerResponse } from "node:http"

const CREATE_INTENT_PATH = "/userapi/transactions/qr"

/** One create-intent call the api made against the stand-in gateway: what it authenticated with and what it referenced. */
export interface E2ESepayIntentCall {
    /** The gateway transaction id the stand-in handed out. */
    readonly gatewayIntentId: string
    /** The Authorization header the api presented. */
    readonly authorization: string | undefined
    /** The reference the api sent: the id of the subscription that is paid for. */
    readonly reference: string
}

const readBody = async (request: IncomingMessage): Promise<string> => {
    const chunks: Array<Buffer> = []
    for await (const chunk of request) chunks.push(Buffer.from(chunk))
    return Buffer.concat(chunks).toString("utf8")
}

const referenceOf = (raw: string): string => {
    try {
        const parsed: unknown = JSON.parse(raw)
        if (typeof parsed === "object" && parsed !== null && "reference" in parsed && typeof parsed.reference === "string") return parsed.reference
    } catch {
        return ""
    }
    return ""
}

/**
 * The payment gateway the run owns: a loopback stand-in for the create-intent endpoint of SePay, so an upgrade really
 * travels api -> gateway -> pending subscription. It creates intents and remembers each call; confirmation is what the
 * real gateway does too: the webhook the spec itself sends to the api door with the shared secret.
 */
export class E2ESepayGateway {
    private readonly calls: Array<E2ESepayIntentCall> = []

    private constructor(
        private readonly server: Server,
        /** The loopback port the OS allocated for this run. */
        readonly port: number,
    ) {}

    /** Starts listening on the given loopback port. */
    static listen(port: number): Promise<E2ESepayGateway> {
        return new Promise((resolve, reject) => {
            const gateway: { current: E2ESepayGateway | null } = { current: null }
            const server = createServer((request, response) => {
                void gateway.current?.answer(request, response)
            })
            server.once("error", reject)
            server.listen(port, "127.0.0.1", () => {
                gateway.current = new E2ESepayGateway(server, port)
                resolve(gateway.current)
            })
        })
    }

    /** The base URL the api is configured with. */
    get baseUrl(): string {
        return `http://127.0.0.1:${this.port}`
    }

    /** The create-intent calls received so far, oldest first. */
    get intentCalls(): ReadonlyArray<E2ESepayIntentCall> {
        return this.calls
    }

    /** Stops listening. */
    close(): Promise<void> {
        return new Promise((resolve) => {
            this.server.close(() => resolve())
            this.server.closeAllConnections()
        })
    }

    private async answer(request: IncomingMessage, response: ServerResponse): Promise<void> {
        if (request.method !== "POST" || request.url !== CREATE_INTENT_PATH) {
            response.writeHead(404).end()
            return
        }
        const reference = referenceOf(await readBody(request))
        const gatewayIntentId = `e2e-sepay-${randomUUID()}`
        this.calls.push({ gatewayIntentId, authorization: request.headers.authorization, reference })
        response.writeHead(200, { "content-type": "application/json" })
        response.end(JSON.stringify({ id: gatewayIntentId, qrCodeUrl: `${this.baseUrl}/checkout/${gatewayIntentId}` }))
    }
}

import { APP_GUARD } from "@nestjs/core"
import { Test } from "@nestjs/testing"
import { BookingStatusSseModule } from "@features/realtime/booking-status"
import { ACCESS_TOKEN_VERIFIER, AuthGuard } from "@modules/domain/identity"
import type { Principal } from "@modules/platform/cqrs"
import { ok, refused } from "@modules/platform/primitives"
import { TestWorldError, TestWorldErrorCode } from "./test-world.error"
import { REALTIME_HUB, RealtimeModule } from "@modules/platform/realtime"
import type { RealtimeHub } from "@modules/platform/realtime"

/** The access tokens of the proof and the principals the verifier answers for them; any other token is refused. */
const PRINCIPALS: Readonly<Record<string, Principal>> = {
    "token-person-1": { id: "person-1", role: "authenticated" },
    "token-person-2": { id: "person-2", role: "authenticated" },
    "token-person-3": { id: "person-3", role: "authenticated" },
}

/** The verifier of the proof: a known token is its principal, anything else is an invalid access token. */
const verifyAccessToken = (token: string) => {
    const principal = PRINCIPALS[token]
    return Promise.resolve(principal === undefined ? refused("SUPABASE_ACCESS_TOKEN_INVALID") : ok(principal))
}

/** One open stream of the proof: the response head and the text read so far. */
export interface RealtimeStreamClient {
    /** The HTTP status of the response. */
    readonly status: number
    /** The response headers. */
    readonly headers: Headers
    /** Reads the stream until the marker has arrived (or the test times out) and answers everything received so far. */
    readonly readUntil: (marker: string) => Promise<string>
    /** Disconnects the client, which is what a closed tab does. */
    readonly disconnect: () => void
}

/**
 * The real api surface of the booking-status channel: the actual SSE door, the actual memory hub and the actual default-deny
 * guard, on a loopback port, with a verifier that knows two principals. The client is a real `fetch` of `text/event-stream`;
 * nothing else of the app is composed, so no database is needed.
 */
export const createRealtimeProof = async () => {
    const moduleRef = await Test.createTestingModule({
        imports: [RealtimeModule.register({ isGlobal: true }), BookingStatusSseModule.register({})],
        providers: [
            { provide: ACCESS_TOKEN_VERIFIER, useFactory: () => verifyAccessToken },
            { provide: APP_GUARD, useClass: AuthGuard },
        ],
    }).compile()
    const app = moduleRef.createNestApplication({ logger: false })
    await app.listen(0, "127.0.0.1")
    const origin = await app.getUrl()
    const hub = app.get<RealtimeHub>(REALTIME_HUB)
    const controllers = new Set<AbortController>()
    const open = async (token: string | undefined, lastEventId?: string): Promise<RealtimeStreamClient> => {
        const controller = new AbortController()
        controllers.add(controller)
        const response = await fetch(`${origin}/booking-status/stream`, {
            signal: controller.signal,
            headers: {
                accept: "text/event-stream",
                ...(token === undefined ? {} : { authorization: `Bearer ${token}` }),
                ...(lastEventId === undefined ? {} : { "last-event-id": lastEventId }),
            },
        })
        const reader = response.body?.pipeThrough(new TextDecoderStream()).getReader()
        let received = ""
        return {
            status: response.status,
            headers: response.headers,
            readUntil: async function readUntil(marker: string): Promise<string> {
                if (received.includes(marker)) return received
                const chunk = await reader?.read()
                if (chunk === undefined || chunk.done) throw new TestWorldError({ code: TestWorldErrorCode.StreamEnded, params: { marker } })
                received += chunk.value
                return readUntil(marker)
            },
            disconnect: () => controller.abort(),
        }
    }
    /** Polls a condition on the event loop (no sleep) until it holds, and fails the test when it never does. */
    const waitFor = async (condition: () => boolean, attempts = 200): Promise<void> => {
        if (condition()) return
        if (attempts === 0) throw new TestWorldError({ code: TestWorldErrorCode.ConditionNeverHeld })
        await new Promise<void>((resolve) => setTimeout(resolve, 5))
        return waitFor(condition, attempts - 1)
    }
    return {
        hub,
        open,
        waitFor,
        close: async () => {
            controllers.forEach((controller) => controller.abort())
            await app.close()
        },
    }
}

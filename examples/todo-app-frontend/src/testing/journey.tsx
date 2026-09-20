/**
 * The journey harness, for the specs that drive a whole screen instead of one half of it.
 *
 * It supplies exactly what a reader's browser supplies and nothing more: a session token in
 * `localStorage` (the real `modules/session`), the English catalogue (the real `messages/en.json`),
 * a per-render SWR cache, and a network that answers GraphQL documents by operation name. Everything
 * above the network runs unmocked - the route's page half, its connected block, its `useSWR`/
 * `useSWRMutation` hooks, the feature transport, `modules/api/graphql.ts` and its refusal unwrapping -
 * so a red spec here means a real journey broke rather than that a mock drifted from the source it
 * replaced.
 *
 * The one seam this file touches is the `fetch` call `modules/api/graphql.ts` owns
 * (FE_FETCH_OUTSIDE_TRANSPORT): the specs borrow that seam, they never substitute an app module.
 */
import type { ReactNode } from "react"
import { render } from "@testing-library/react"
import { vi } from "vitest"
import { NextIntlClientProvider } from "next-intl"
import { SWRConfig } from "swr"
import { clearToken, setToken } from "@/modules/session"
import messages from "../messages/en.json"

/** The variables one operation carried, exactly as the client serialized them. */
export type WireVariables = Readonly<Record<string, unknown>>;

/** One answer the stubbed network can give an operation.
 * - `data` - the payload for the operation's own root field, the shape a good response takes.
 * - `reason`/`code` - a refused response: `errors[0].message` plus the stable code on `extensions`.
 * - `network: true` - the request never reached the backend at all. */
export type WireReply =
  | { readonly data: unknown }
  | { readonly reason: string; readonly code?: string }
  | { readonly network: true };

/** A route's answer, or a function of the variables and the call index for the operations whose
 * reply depends on what the client actually sent. A route may hand back a promise, which is how a
 * spec holds a write open long enough to see the screen's own pending state. */
export type WireRoute = WireReply | ((variables: WireVariables, call: number) => WireReply | Promise<WireReply>);

/** One request the client made, recorded in order. */
export type WireCall = {
  readonly operation: string;
  readonly variables: WireVariables;
  readonly token: string | null;
  readonly document: string;
};

/** The stubbed network: the fixture routes plus every request the screen made against them. */
export type Wire = {
  readonly calls: Array<WireCall>;
  /** Every recorded request for one operation, in the order they were sent. */
  readonly callsFor: (operation: string) => Array<WireCall>;
  /** True once `readOperation` was sent again AFTER `writeOperation` - the honest form of "the list
   * re-read after the write". A count is not asserted because a mutation that shares its
   * collection's SWR key is revalidated by SWR itself as well as by whatever the block asks for, so
   * the number of round trips is an implementation detail while the re-read is the promise. */
  readonly reReadAfter: (readOperation: string, writeOperation: string) => boolean;
};

/** The root field of an operation document - `query Foo($x: ID!) { foo(x: $x) { a } }` names `foo`. */
const operationOf = (document: string): string => {
    const afterBrace = document.slice(document.indexOf("{") + 1)
    const name = /^[A-Za-z_][A-Za-z0-9_]*/.exec(afterBrace.trimStart())
    return name === null ? "" : name[0]
}

const BEARER_PREFIX = "Bearer "

/** The `fetch` this harness replaced, kept so the world can be given back exactly as it was found. */
let replacedFetch: typeof fetch | undefined

/**
 * Answer every GraphQL document this screen sends from `routes`, keyed by the operation's root field.
 *
 * An operation with no route is refused with `UNROUTED` and a sentence naming it rather than thrown,
 * because a throw inside `fetch` is swallowed by `graphql.ts`'s never-throws contract and would come
 * back as an unrelated network refusal; this way the screen's own refusal text says which fixture was
 * missing.
 *
 * @param routes - The fixture answers by operation name.
 * @returns The wire: every request the screen made, and the per-operation view of them.
 */
export const serveGraphQL = (routes: Readonly<Record<string, WireRoute>>): Wire => {
    const calls: Array<WireCall> = []
    const fetchStub = vi.fn<typeof fetch>(async (_input, init) => {
        const body = JSON.parse(String((init as RequestInit).body)) as { query: string; variables?: WireVariables }
        const headers = (init as RequestInit).headers as Record<string, string>
        const authorization = headers.authorization ?? headers.Authorization
        const call: WireCall = {
            operation: operationOf(body.query),
            variables: body.variables ?? {},
            token: authorization === undefined ? null : authorization.slice(BEARER_PREFIX.length),
            document: body.query,
        }
        calls.push(call)
        const route = Object.prototype.hasOwnProperty.call(routes, call.operation)
            ? routes[call.operation]
            : undefined
        const reply: WireReply =
      route === undefined
          ? { reason: `No fixture route for the "${call.operation}" operation.`, code: "UNROUTED" }
          : typeof route === "function"
              ? await route(call.variables, calls.filter(previous => previous.operation === call.operation).length - 1)
              : route
        if ("network" in reply) {
            throw new Error("the network never carried this request")
        }
        // A real Response, not a look-alike: the transport reads `response.json()`, and the stub
        // staying inside `typeof fetch` is what lets `global.fetch = fetchStub` hold without a cast.
        const payload = "data" in reply
            ? { data: { [call.operation]: reply.data } }
            : { errors: [{ message: reply.reason, extensions: { code: reply.code } }] }
        return new Response(JSON.stringify(payload), {
            status: 200,
            headers: { "content-type": "application/json" },
        })
    })
    replacedFetch ??= global.fetch
    global.fetch = fetchStub
    return {
        calls,
        callsFor: operation => calls.filter(call => call.operation === operation),
        reReadAfter: (readOperation, writeOperation) => {
            const operations = calls.map(call => call.operation)
            const written = operations.indexOf(writeOperation)
            return written >= 0 && operations.indexOf(readOperation, written + 1) > written
        },
    }
}

/** Give back the real `fetch`, drop the session and forget the downloads, so no journey inherits
 * another's world. */
export const resetJourneyWorld = (): void => {
    if (replacedFetch !== undefined) {
        global.fetch = replacedFetch
        replacedFetch = undefined
    }
    vi.unstubAllGlobals()
    clearToken()
    resetObjectUrls()
}

/** Put a session token where the app reads it, the way a completed sign-in leaves it. */
export const seedSession = (token: string): void => {
    setToken(token)
}

/**
 * Mount a screen in the world a reader's browser gives it: the English catalogue and a private SWR
 * cache, so one spec's cached rows never answer another spec's request.
 *
 * `shouldRetryOnError: false` is deliberate and not a convenience: SWR's retry would fire a second
 * request after the refusal the spec is asserting, so an assertion about the request count - and the
 * refusal sentence that arrives with it - would depend on how long the machine took rather than on
 * what the screen did.
 */
export const renderJourney = (ui: ReactNode): ReturnType<typeof render> =>
    render(
        <SWRConfig
            value={{
                provider: () => new Map(),
                dedupingInterval: 0,
                shouldRetryOnError: false,
                revalidateOnFocus: false,
            }}
        >
            <NextIntlClientProvider locale="en" messages={messages}>
                {ui}
            </NextIntlClientProvider>
        </SWRConfig>,
    )

/** Every object URL this world handed out, in issue order, with what became of it. */
type IssuedObjectUrl = {
  readonly url: string;
  readonly blob: Blob;
  revoked: boolean;
};

const ISSUED: Array<IssuedObjectUrl> = []

/**
 * The object-URL seam.
 *
 * jsdom implements neither `URL.createObjectURL` nor `URL.revokeObjectURL`, and the privacy
 * screen's export reaches the reader's disk through exactly that pair. Rather than let the screen
 * catch a TypeError and report a refusal the reader would never see, the harness supplies the
 * browser behaviour and remembers every URL it issued - content included, and kept after revoke,
 * which is what lets a spec assert that the download carried the reader's own rows and that the
 * app released the URL afterwards.
 */
if (typeof URL.createObjectURL !== "function") {
    Object.defineProperty(URL, "createObjectURL", {
        configurable: true,
        writable: true,
        value: (blob: Blob) => {
            const issued: IssuedObjectUrl = { url: `blob:todo-app-journey/${ISSUED.length + 1}`, blob, revoked: false }
            ISSUED.push(issued)
            return issued.url
        },
    })
    Object.defineProperty(URL, "revokeObjectURL", {
        configurable: true,
        writable: true,
        value: (url: string) => {
            const issued = ISSUED.find(entry => entry.url === url)
            if (issued !== undefined) issued.revoked = true
        },
    })
}

/** Forget every object URL issued so far; called between specs, never by one mid-journey. */
export const resetObjectUrls = (): void => {
    ISSUED.length = 0
}

/** The object URLs issued since the last reset, oldest first. */
export const issuedObjectUrls = (): Array<string> => ISSUED.map(entry => entry.url)

/** What the browser was told to download under `url`, read back as text. */
export const readObjectUrl = async (url: string): Promise<string> => {
    const issued = ISSUED.find(entry => entry.url === url)
    if (issued === undefined) throw new Error(`No object URL "${url}" was issued by this journey.`)
    // jsdom's Blob predates the async readers; FileReader is the same browser seam either way.
    if (typeof issued.blob.text === "function") return issued.blob.text()
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(reader.error)
        reader.readAsText(issued.blob)
    })
}

/** Whether the app revoked `url` once the download was handed over. */
export const isObjectUrlRevoked = (url: string): boolean => {
    const issued = ISSUED.find(entry => entry.url === url)
    if (issued === undefined) throw new Error(`No object URL "${url}" was issued by this journey.`)
    return issued.revoked
}

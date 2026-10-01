/** The worker side of the control channel: a typed HTTP bridge to one fake and the handles a spec holds. */
import { TestWorldError, TestWorldErrorCode } from "../../errors"
import type { FakeBridge, FakeClient, FakeDefinition } from "./contracts"

const CONTROL_TIMEOUT_MS = 30_000

const failure = (fake: string, action: string, status: number | null, detail: string, cause?: unknown): TestWorldError =>
    new TestWorldError({
        code: TestWorldErrorCode.FakeControlFailed,
        params: { detail: `fake "${fake}" action "${action}" ${detail}`, fake, action, status },
        cause,
    })

/** Builds the bridge of one fake; `controlUrl` is the base the host published (`http://127.0.0.1:<port>/control`). */
export const createFakeBridge = (controlUrl: string, fakeName: string, webhookTarget: (app?: string) => string): FakeBridge => ({
    call: async <T>(action: string, body?: unknown): Promise<T> => {
        const url = `${controlUrl.replace(/\/+$/, "")}/${encodeURIComponent(fakeName)}/${encodeURIComponent(action)}`
        let response: Response
        try {
            response = await fetch(url, {
                method: body === undefined ? "GET" : "POST",
                headers: body === undefined ? {} : { "content-type": "application/json" },
                body: body === undefined ? undefined : JSON.stringify(body),
                signal: AbortSignal.timeout(CONTROL_TIMEOUT_MS),
            })
        } catch (cause) {
            throw failure(fakeName, action, null, "could not reach the fakes host", cause)
        }
        const text = await response.text()
        if (!response.ok) throw failure(fakeName, action, response.status, `answered ${response.status}: ${text}`)
        return (text === "" ? undefined : JSON.parse(text)) as T
    },
    webhookTarget,
})

/** Builds the handle of every declared fake (`world.fake.<name>`). */
export const createFakeHandles = (
    definitions: Readonly<Record<string, FakeDefinition>>,
    controlUrl: string,
    webhookTarget: (app?: string) => string,
): Record<string, FakeClient> => {
    const handles: Record<string, FakeClient> = {}
    for (const [name, definition] of Object.entries(definitions)) {
        handles[name] = definition.client(createFakeBridge(controlUrl, name, webhookTarget))
    }
    return handles
}

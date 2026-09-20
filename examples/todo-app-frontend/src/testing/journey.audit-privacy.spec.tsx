import { afterEach, describe, expect, it, vi } from "vitest"
import { fireEvent, screen, waitFor } from "@testing-library/react"
import { PrivacyPage } from "@/components/pages/PrivacyPage"
import {
    isObjectUrlRevoked,
    issuedObjectUrls,
    readObjectUrl,
    renderJourney,
    resetJourneyWorld,
    seedSession,
    serveGraphQL,
    type Wire,
    type WireReply,
    type WireRoute,
} from "@/testing/journey"

const mocks = vi.hoisted(() => ({ push: vi.fn() }))

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }))

/** The audit lines `exportMyData` answers with - the reader's own rows, in the wire spelling. */
const EXPORT_ROWS = [
    { at: "2026-09-18T08:00:00Z", action: "task.create", target: "task/t-1" },
    { at: "2026-09-18T08:01:00Z", action: "task.complete", target: "task/t-1" },
]

/** A signed-in reader whose export and erasure mutations the wire answers. */
const privacyWorld = (overrides: Readonly<Record<string, WireRoute>> = {}): Wire => {
    seedSession("tok-audit")
    return serveGraphQL({
        exportMyData: { data: EXPORT_ROWS },
        requestErasure: { data: { requestId: "req-1", state: "pending" } },
        completeErasure: { data: { requestId: "req-1", state: "complete" } },
        signOut: { data: { signedOut: true } },
        ...overrides,
    })
}

/**
 * The journey `audit/uat/right-to-be-forgotten` walks on this screen: a person exports the
 * records the log keeps about them, then asks for erasure and confirms it in place. Mounted at
 * the route's own page half, so the connected block, the audit transport, the GraphQL fetcher and
 * the object-URL download all run in the order a reader's browser runs them.
 */
describe("ui.audit.privacy journey: the served privacy screen over the real transport", () => {
    afterEach(() => {
        resetJourneyWorld()
        mocks.push.mockReset()
    })

    it("idle: the screen offers the export and the erasure request, and sends nothing unasked", () => {
        const wire = privacyWorld()
        renderJourney(<PrivacyPage />)

        expect(screen.getByRole("button", { name: "Export my data" })).toBeEnabled()
        expect(screen.getByRole("button", { name: "Request erasure" })).toBeEnabled()
        expect(wire.calls).toHaveLength(0)
    })

    it("export: the reader's own rows arrive as a real download, then the object URL is released", async () => {
        const wire = privacyWorld()
        renderJourney(<PrivacyPage />)

        fireEvent.click(screen.getByRole("button", { name: "Export my data" }))

        await waitFor(() => expect(wire.callsFor("exportMyData")).toHaveLength(1))
        expect(wire.callsFor("exportMyData")[0].token).toBe("tok-audit")

        const issued = issuedObjectUrls()
        expect(issued).toHaveLength(1)
        const download = await readObjectUrl(issued[0])
        expect(JSON.parse(download)).toEqual(EXPORT_ROWS)
        // The screen hands the file over and releases the handle - nothing lingers in memory.
        expect(isObjectUrlRevoked(issued[0])).toBe(true)
        await waitFor(() => expect(screen.getByRole("button", { name: "Export my data" })).toBeEnabled())
    })

    it("exporting: the pending read holds the button in its busy frame until the file is handed over", async () => {
        let release: (reply: WireReply) => void = () => {}
        const pending = new Promise<WireReply>(resolve => {
            release = resolve
        })
        privacyWorld({ exportMyData: () => pending })
        renderJourney(<PrivacyPage />)

        fireEvent.click(screen.getByRole("button", { name: "Export my data" }))
        await waitFor(() => expect(screen.getByRole("button", { name: "Exporting…" })).toBeInTheDocument())

        release({ data: EXPORT_ROWS })
        await waitFor(() => expect(screen.getByRole("button", { name: "Export my data" })).toBeInTheDocument())
    })

    it("a failed export names its own sentence and leaves the erasure section untouched", async () => {
        privacyWorld({ exportMyData: { reason: "The export could not be assembled.", code: "AUDIT_EXPORT_REFUSED" } })
        renderJourney(<PrivacyPage />)

        fireEvent.click(screen.getByRole("button", { name: "Export my data" }))

        await waitFor(() => expect(screen.getByText("We couldn't prepare your export. Try again.")).toBeInTheDocument())
        expect(screen.getByRole("button", { name: "Request erasure" })).toBeEnabled()
    })

    it("requesting-erasure: the consequence confirmation opens in place and cancel leaves without writing", async () => {
        const wire = privacyWorld()
        renderJourney(<PrivacyPage />)

        fireEvent.click(screen.getByRole("button", { name: "Request erasure" }))
        await waitFor(() => expect(screen.getByRole("button", { name: "Confirm erasure" })).toBeInTheDocument())
        expect(wire.callsFor("requestErasure")).toHaveLength(0)

        fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
        await waitFor(() => expect(screen.getByRole("button", { name: "Request erasure" })).toBeInTheDocument())
        expect(wire.calls).toHaveLength(0)
    })

    it("erasure-complete: the confirmed request runs both mutations in order and reports completion", async () => {
        const wire = privacyWorld()
        renderJourney(<PrivacyPage />)

        fireEvent.click(screen.getByRole("button", { name: "Request erasure" }))
        await waitFor(() => expect(screen.getByRole("button", { name: "Confirm erasure" })).toBeInTheDocument())
        fireEvent.click(screen.getByRole("button", { name: "Confirm erasure" }))

        await waitFor(() => expect(
            screen.getByText(/Your erasure request is complete/),
        ).toBeInTheDocument())
        const request = wire.callsFor("requestErasure")[0]
        const complete = wire.callsFor("completeErasure")[0]
        expect(request.token).toBe("tok-audit")
        // completeErasure follows the request it answers for - order and id are the record's promise.
        expect(complete.variables).toEqual({ requestId: "req-1" })
        expect(wire.calls.map(call => call.operation)).toEqual(["requestErasure", "completeErasure"])
        // A completed erasure is terminal on this screen: neither action is offered again.
        expect(screen.queryByRole("button", { name: "Export my data" })).not.toBeInTheDocument()
        expect(screen.queryByRole("button", { name: "Request erasure" })).not.toBeInTheDocument()
    })

    it("erasure-refused: a failed request is named and the screen offers the request again", async () => {
        privacyWorld({ requestErasure: { reason: "Erasure is not available.", code: "AUDIT_ERASURE_REFUSED" } })
        renderJourney(<PrivacyPage />)

        fireEvent.click(screen.getByRole("button", { name: "Request erasure" }))
        await waitFor(() => expect(screen.getByRole("button", { name: "Confirm erasure" })).toBeInTheDocument())
        fireEvent.click(screen.getByRole("button", { name: "Confirm erasure" }))

        await waitFor(() => expect(
            screen.getByText("We couldn't submit your erasure request. Try again."),
        ).toBeInTheDocument())
        expect(screen.getByRole("button", { name: "Request erasure" })).toBeEnabled()
    })

    it("a reader with no session is told to sign in again and no call ever leaves", async () => {
        const wire = serveGraphQL({})
        renderJourney(<PrivacyPage />)

        fireEvent.click(screen.getByRole("button", { name: "Export my data" }))

        await waitFor(() => expect(
            screen.getByText("You need to sign in again before your data can be exported."),
        ).toBeInTheDocument())
        expect(wire.calls).toHaveLength(0)
        expect(issuedObjectUrls()).toHaveLength(0)
    })
})

import * as billing from "@modules/events/billing"
import { breakingChanges, readContractFile, samplePayload } from "../../fixtures/builders/event-contract.builder"

const classes = Object.values(billing)
const contract = readContractFile("billing", "events.json")

describe("billing event contract", () => {
    it("publishes exactly the events the billing event classes declare, at the same version", () => {
        expect(classes.map((event) => event.eventName).sort((a, b) => a.localeCompare(b))).toEqual(
            Object.keys(contract.events).sort((a, b) => a.localeCompare(b)),
        )
        for (const event of classes) expect(event.version).toBe(contract.events[event.eventName]?.version)
    })

    describe.each(Object.entries(contract.events))("%s", (name, event) => {
        const consumer = classes.find((candidate) => candidate.eventName === name)

        it("is read by its consumer from a payload with the contract fields", () => {
            expect(consumer?.parse({ eventId: "e1", payload: samplePayload(event) })).not.toBeNull()
        })

        it("tolerates a field the contract does not know yet", () => {
            expect(consumer?.parse({ eventId: "e1", payload: { ...samplePayload(event), added: "x" } })).not.toBeNull()
        })

        it.each(Object.keys(event.payload))("is refused by its consumer without %s", (field) => {
            const { [field]: _dropped, ...rest } = samplePayload(event)
            expect(consumer?.parse({ eventId: "e1", payload: rest })).toBeNull()
        })
    })

    it("evolves only additively over its pinned contract", () => {
        expect(breakingChanges(readContractFile("billing", "events.pin.json"), contract)).toEqual([])
    })
})

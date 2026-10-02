import * as order from "@modules/events/order"
import { breakingChanges, readContractFile, samplePayload } from "../../fixtures/contracts/event.contracts"

const classes = Object.values(order)
const contract = readContractFile("order", "events.json")

describe("order event contract", () => {
    it("publishes exactly the events the order event classes declare, at the same version", () => {
        expect(classes.map((event) => event.eventName).sort()).toEqual(Object.keys(contract.events).sort())
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
        expect(breakingChanges(readContractFile("order", "events.pin.json"), contract)).toEqual([])
    })
})

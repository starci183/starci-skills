import { readFileSync } from "node:fs"
import { join } from "node:path"
import { isRecord } from "@modules/platform/primitives"

/** One event of a service's published contract. */
export interface EventContract {
    /** The payload fields and their types. */
    readonly payload: Readonly<Record<string, string>>
    /** The contract version of the event. */
    readonly version: number
}

/** A service's published event contract file. */
export interface EventContractFile {
    /** The events by name. */
    readonly events: Readonly<Record<string, EventContract>>
    /** The service that publishes them. */
    readonly service: string
    /** Why the file could not be read, when it could not. */
    readonly problem?: unknown
}

const NO_EVENT: EventContract = { payload: {}, version: -1 }

const readEvent = (value: unknown): EventContract => {
    if (!isRecord(value) || typeof value.version !== "number" || !isRecord(value.payload)) return NO_EVENT
    const payload: Record<string, string> = {}
    for (const [field, type] of Object.entries(value.payload)) {
        if (typeof type === "string") payload[field] = type
    }
    return { payload, version: value.version }
}

/** Reads `be/contracts/<service>/<file>`; a malformed file reads as one without events, so the specs that compare it fail on the mismatch. */
export const readContractFile = (service: string, file: "events.json" | "events.pin.json"): EventContractFile => {
    let parsed: unknown = null
    try {
        parsed = JSON.parse(readFileSync(join(__dirname, "../../../../contracts", service, file), "utf8"))
    } catch (cause) {
        return { events: {}, service, problem: cause }
    }
    if (!isRecord(parsed) || !isRecord(parsed.events)) return { events: {}, service }
    return {
        events: Object.fromEntries(Object.entries(parsed.events).map(([name, event]) => [name, readEvent(event)])),
        service,
    }
}

/** A value of the contract type `type`. */
export const sampleOf = (type: string): string | number => (type.startsWith("number") ? 1 : "x")

/** A payload carrying every required field of `contract`. */
export const samplePayload = (contract: EventContract): Record<string, string | number> =>
    Object.fromEntries(
        Object.entries(contract.payload)
            .filter(([, type]) => !type.endsWith("?"))
            .map(([field, type]) => [field, sampleOf(type)]),
    )

const eventProblems = (name: string, event: EventContract, next: EventContract | undefined): Array<string> => {
    if (!next) return [`${name} was removed; publish ${name}.v2 instead`]
    const problems: Array<string> = []
    if (next.version !== event.version) problems.push(`${name} changed version; publish ${name}.v2 instead`)
    for (const [field, type] of Object.entries(event.payload)) {
        if (next.payload[field] !== type)
            problems.push(`${name}.${field} was removed or retyped; publish ${name}.v2 instead`)
    }
    for (const [field, type] of Object.entries(next.payload)) {
        if (!(field in event.payload) && !type.endsWith("?"))
            problems.push(`${name}.${field} is new and must be optional`)
    }
    return problems
}

/** The problems that make `current` break the consumers of `pinned`: a removed event, a version change, a removed or retyped field, a new required field. */
export const breakingChanges = (pinned: EventContractFile, current: EventContractFile): Array<string> =>
    Object.entries(pinned.events).flatMap(([name, event]) => eventProblems(name, event, current.events[name]))

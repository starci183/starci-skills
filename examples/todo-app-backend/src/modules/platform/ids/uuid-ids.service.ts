import { randomUUID } from "node:crypto"
import type { Ids } from "./ids.port"

/** The production ids: the one place that calls the ambient UUID generator. It has no dependencies, so the DI container builds it without a decorator. */
export class UuidIds implements Ids {
    /** A new random UUID. */
    next(): string {
        return randomUUID()
    }
}

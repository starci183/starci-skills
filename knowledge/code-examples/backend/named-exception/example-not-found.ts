import type {
    AbstractExceptionMetadata,
} from "./abstract"
import {
    AbstractException,
} from "./abstract"

/** Example item id that did not match any row. */
export interface ExampleNotFoundExceptionMetadata extends AbstractExceptionMetadata {
    id?: string
}

/**
 * Fails the request when the example item id is unknown.
 * Always constructed with one metadata object (empty `{}` is valid).
 */
export class ExampleNotFoundException extends AbstractException {
    constructor({
        id,
        originalError,
    }: ExampleNotFoundExceptionMetadata) {
        super(
            "Example not found",
            "EXAMPLE_NOT_FOUND_EXCEPTION",
            {
                id,
                originalError,
            },
        )
    }
}

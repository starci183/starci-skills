/** Fixture: the pipe of an operation route body, given the class that mirrors the envelope. */
export class OperationValidationService {
    constructor(readonly envelope: new () => object) {}

    /** Answers the body as it came. */
    transform(value: unknown): unknown {
        return value
    }
}

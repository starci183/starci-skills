import {
    DomainError 
} from "./domain-error"

class SampleError extends DomainError {
    constructor(cause?: unknown) {
        super("SAMPLE",
            "A sample failed.",
            {
                cause, metadata: {
                    id: 7 
                } 
            })
    }
}

class BareError extends DomainError {
    constructor() {
        super("BARE",
            "Nothing attached.")
    }
}

describe("DomainError",
    () => {
        it("carries a code, a sentence, metadata and the class name",
            () => {
                const error = new SampleError()

                expect(error).toBeInstanceOf(Error)
                expect(error.name).toBe("SampleError")
                expect(error.code).toBe("SAMPLE")
                expect(error.message).toBe("A sample failed.")
                expect(error.metadata).toEqual({
                    id: 7 
                })
            })

        it("keeps the failure that caused it as cause",
            () => {
                const cause = new Error("driver down")

                expect(new SampleError(cause).cause).toBe(cause)
            })

        it("has empty metadata and no cause when the throw site attached none",
            () => {
                const error = new BareError()

                expect(error.metadata).toEqual({
                })
                expect(error.cause).toBeUndefined()
            })
    })

import { DomainError } from "./domain-error"

class SampleError extends DomainError {}

describe("DomainError", () => {
    it("carries the code, the message and the cause, and is named after its subclass", () => {
        const cause = new SyntaxError("bad input")
        const error = new SampleError("SAMPLE_FAILED", "The sample failed.", { cause })
        expect(error.code).toBe("SAMPLE_FAILED")
        expect(error.message).toBe("The sample failed.")
        expect(error.cause).toBe(cause)
        expect(error.name).toBe("SampleError")
        expect(error).toBeInstanceOf(Error)
    })
})

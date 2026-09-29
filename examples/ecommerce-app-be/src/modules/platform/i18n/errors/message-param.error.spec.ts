import {
    MessageParamError 
} from "./message-param.error"

describe("MessageParamError",
    () => {
        it("carries a stable code, the key and the placeholder",
            () => {
                const error = new MessageParamError("plan.cap",
                    "limit")

                expect(error.code).toBe("MESSAGE_PARAM_MISSING")
                expect(error.key).toBe("plan.cap")
                expect(error.param).toBe("limit")
            })
    })

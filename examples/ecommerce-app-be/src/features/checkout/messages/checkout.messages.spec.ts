import {
    CHECKOUT_MESSAGES 
} from "./checkout.messages"

describe("CHECKOUT_MESSAGES",
    () => {
        it("answers in English by default, exactly as the wire contract phrases it, and in Vietnamese on request",
            () => {
                expect(CHECKOUT_MESSAGES.get("session.tokenRequired")).toBe("A Bearer session token is required.")
                expect(CHECKOUT_MESSAGES.get("session.tokenRequired",
                    {
                    },
                    "vi")).toBe("Cần có mã phiên Bearer.")
            })

        it("has non-empty text in both languages for every key",
            () => {
                for (const key of ["addCartItem.invalid",
                    "session.tokenRequired",
                    "session.noLiveSession",
                    "session.noHttpRequest",
                    "session.noActor"] as const) {
                    expect(CHECKOUT_MESSAGES.get(key,
                        {
                        },
                        "vi").trim()).not.toBe("")
                    expect(CHECKOUT_MESSAGES.get(key,
                        {
                        },
                        "en").trim()).not.toBe("")
                }
            })
    })

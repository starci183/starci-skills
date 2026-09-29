import {
    IDENTITY_MESSAGES 
} from "./identity.messages"

describe("IDENTITY_MESSAGES",
    () => {
        it("answers in English by default, exactly as the wire contract phrases it, and in Vietnamese on request",
            () => {
                expect(IDENTITY_MESSAGES.get("session.noLiveSession")).toBe("No live session answers this token.")
                expect(IDENTITY_MESSAGES.get("session.noLiveSession",
                    {
                    },
                    "vi")).toBe("Không có phiên nào còn hiệu lực ứng với mã này.")
            })

        it("has non-empty text in both languages for every key",
            () => {
                for (const key of ["register.description",
                    "register.invalid",
                    "signIn.description",
                    "signIn.invalid",
                    "account.description",
                    "session.noLiveSession",
                    "session.tokenRequired"] as const) {
                    expect(IDENTITY_MESSAGES.get(key,
                        {
                        },
                        "vi").trim()).not.toBe("")
                    expect(IDENTITY_MESSAGES.get(key,
                        {
                        },
                        "en").trim()).not.toBe("")
                }
            })
    })

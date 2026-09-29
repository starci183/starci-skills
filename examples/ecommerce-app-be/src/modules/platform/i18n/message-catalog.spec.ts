import {
    MessageParamError 
} from "./errors/message-param.error"
import {
    createMessageCatalog 
} from "./message-catalog"

const catalog = createMessageCatalog({
    vi: {
        greeting: "Xin chao {name}", plain: "Khong co tham so" 
    },
    en: {
        greeting: "Hello {name}", plain: "No parameters" 
    },
})

describe("createMessageCatalog",
    () => {
        it("answers in the default locale (en) when no locale is named",
            () => {
                expect(catalog.get("plain")).toBe("No parameters")
            })

        it("answers in the requested locale",
            () => {
                expect(catalog.get("plain",
                    {
                    },
                    "vi")).toBe("Khong co tham so")
            })

        it("fills named placeholders with strings and numbers",
            () => {
                expect(catalog.get("greeting",
                    {
                        name: "An" 
                    })).toBe("Hello An")
                expect(catalog.get("greeting",
                    {
                        name: 7 
                    },
                    "vi")).toBe("Xin chao 7")
            })

        it("honors a different default locale",
            () => {
                const vietnameseFirst = createMessageCatalog({
                    vi: {
                        plain: "Mot" 
                    }, en: {
                        plain: "One" 
                    } 
                },
                "vi")

                expect(vietnameseFirst.get("plain")).toBe("Mot")
            })

        it("stops with the key and the placeholder when a value is missing",
            () => {
                expect(() => catalog.get("greeting")).toThrow(MessageParamError)
                expect(() => catalog.get("greeting")).toThrow("Message greeting needs a value for {name}.")
            })
    })

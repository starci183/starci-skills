import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { ChatBubble } from "./index.js"

describe("ChatBubble", () => {
    it("renders the message anatomy for an incoming message", () => {
        const html = renderToStaticMarkup(
            <ChatBubble author="Linh" meta="09:12" avatar={<span>L</span>} status={<em>AI</em>} actions={<button type="button">Reply</button>} footer={<b>card</b>}>
                Hello
            </ChatBubble>,
        )
        expect(html).toContain('data-component="ChatBubble"')
        expect(html).toContain('data-grammar-bubble-side="incoming"')
        for (const part of ["avatar", "head", "author", "meta", "body", "footer", "actions"]) expect(html).toContain(`starci-core-chat-bubble-${part}`)
        expect(html).toContain("<em>AI</em>")
    })

    it("marks the reader's own message and drops empty slots", () => {
        const html = renderToStaticMarkup(<ChatBubble side="outgoing" id="m-1" isHighlight>Done</ChatBubble>)
        expect(html).toContain('data-grammar-bubble-side="outgoing"')
        expect(html).toContain('data-grammar-bubble-highlight="true"')
        expect(html).toContain('id="m-1"')
        expect(html).not.toContain("starci-core-chat-bubble-head")
        expect(html).not.toContain("starci-core-chat-bubble-avatar")
    })
})

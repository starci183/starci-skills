import type { ReactNode } from "react"

/** `incoming`: someone else wrote it (start side, recessed face). `outgoing`: the reader's own message (end side, accent-soft face). */
export type ChatBubbleSide = "incoming" | "outgoing"

export type ChatBubbleProps = {
    /** The message body. Plain text keeps its line breaks. */
    readonly children: ReactNode
    readonly side?: ChatBubbleSide
    /** Who wrote it, shown above the body. Omit on consecutive messages from the same author. */
    readonly author?: ReactNode
    /** An `Avatar` or `IconTile` beside the bubble. Omit (or pass the same width of nothing) on grouped follow-ups. */
    readonly avatar?: ReactNode
    /** The time or delivery state, muted after the author. */
    readonly meta?: ReactNode
    /** A short marker beside the author, e.g. a neutral `Badge` "AI". */
    readonly status?: ReactNode
    /** Quiet message actions (copy, reply, react), revealed on hover and keyboard focus inside the message. */
    readonly actions?: ReactNode
    /** Content under the body that is not part of the message text: an attachment, an approval card, a reaction row. */
    readonly footer?: ReactNode
    /** Draws the focus ring around the bubble, e.g. when a link jumps to this message. */
    readonly isHighlight?: boolean
    /** Anchor for links that jump to this message. */
    readonly id?: string
}

/**
 * One chat message. The app owns the thread (order, grouping, day dividers with `Divider label`, scroll with
 * `VerticalScrollRegion`); this owns the anatomy of a single message: avatar column, author line, the bubble face and its
 * actions. Faces follow SURFACE-3 (incoming, recessed) and SURFACE-4 (outgoing, the raised accent-soft pair); the corner on
 * the author's side tightens to point at the avatar (RADIUS-6).
 */
export const ChatBubble = ({
    children,
    side = "incoming",
    author,
    avatar,
    meta,
    status,
    actions,
    footer,
    isHighlight = false,
    id,
}: ChatBubbleProps) => {
    const hasHead = author != null || meta != null || status != null
    return (
        <div
            {...(id === undefined ? {} : { id })}
            className="starci-core-chat-bubble"
            data-component="ChatBubble"
            data-tier="composite"
            data-contract="SURFACE-3 SURFACE-4 RADIUS-6"
            data-grammar-bubble-side={side}
            data-grammar-bubble-highlight={isHighlight ? "true" : "false"}
        >
            {avatar == null ? null : <div className="starci-core-chat-bubble-avatar">{avatar}</div>}
            <div className="starci-core-chat-bubble-stack">
                {hasHead ? (
                    <div className="starci-core-chat-bubble-head">
                        {author == null ? null : <span className="starci-core-chat-bubble-author">{author}</span>}
                        {status}
                        {meta == null ? null : <span className="starci-core-chat-bubble-meta">{meta}</span>}
                    </div>
                ) : null}
                <div className="starci-core-chat-bubble-body">{children}</div>
                {footer == null ? null : <div className="starci-core-chat-bubble-footer">{footer}</div>}
                {actions == null ? null : <div className="starci-core-chat-bubble-actions">{actions}</div>}
            </div>
        </div>
    )
}

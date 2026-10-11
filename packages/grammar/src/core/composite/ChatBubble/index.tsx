import type { ReactNode } from "react"
import { Skeleton } from "../../primitive/Skeleton/index.js"

/** `incoming`: someone else wrote it (start side, recessed face). `outgoing`: the reader's own message (end side, accent-soft face). */
export type ChatBubbleSide = "incoming" | "outgoing"

export type ChatBubbleProps = {
    /** The message body. Plain text keeps its line breaks. Ignored (and optional) while `isSkeleton`. */
    readonly children?: ReactNode
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
    /**
     * Draw the message as inert geometry while it is unresolved (knowledge STATE-8): the bubble face on its `side`, with two
     * Skeleton text lines in the body and, only if `avatar` is passed, a Skeleton circle in its column. No author, meta, status,
     * actions or footer are drawn, so no control exists. The bubble is `aria-hidden`; the conversation owns `aria-busy`
     * (`ChatBubbleSkeletons` draws a whole loading thread).
     */
    readonly isSkeleton?: boolean
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
    isSkeleton = false,
}: ChatBubbleProps) => {
    if (isSkeleton) {
        return (
            <div
                aria-hidden="true"
                className="starci-core-chat-bubble"
                data-component="ChatBubble"
                data-tier="composite"
                data-contract="SURFACE-3 SURFACE-4 RADIUS-6 STATE-8"
                data-grammar-bubble-side={side}
                data-grammar-bubble-highlight="false"
                data-grammar-bubble-footer="false"
                data-grammar-skeleton="true"
            >
                {avatar == null ? null : <div className="starci-core-chat-bubble-avatar"><Skeleton shape="circle" size="sm" /></div>}
                <div className="starci-core-chat-bubble-stack">
                    <div className="starci-core-chat-bubble-body starci-core-chat-bubble-skeleton-body"><Skeleton shape="text" lines={2} /></div>
                </div>
            </div>
        )
    }
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
            data-grammar-bubble-footer={footer == null ? "false" : "true"}
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

export type ChatBubbleSkeletonsProps = {
    /** How many bubbles (default 3, 1 to 12). They alternate sides, starting with `incoming`. */
    readonly count?: number
    /** Gives every bubble a Skeleton avatar circle in its column. */
    readonly hasAvatar?: boolean
}

/**
 * A loading conversation: `count` skeleton bubbles that alternate incoming and outgoing, inside one `aria-busy` thread.
 * Place it as the conversation content of a `ChatWorkspace` (or any scroll owner) while the messages are unresolved.
 */
export const ChatBubbleSkeletons = ({ count = 3, hasAvatar = false }: ChatBubbleSkeletonsProps) => (
    <div className="starci-core-chat-bubble-thread" data-grammar-chat-skeleton-thread="true" data-loading="true" aria-busy="true">
        {Array.from({ length: Math.min(12, Math.max(1, Math.floor(Number.isFinite(count) ? count : 3))) }, (_, index) => (
            <ChatBubble key={index} isSkeleton side={index % 2 === 0 ? "incoming" : "outgoing"} avatar={hasAvatar && index % 2 === 0 ? <span /> : undefined} />
        ))}
    </div>
)

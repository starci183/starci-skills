import { cn } from "@heroui/react"

/**
 * Markdown geometry is SHIPPED. Each name below is the hook for a `.starci-core-*` rule in
 * `src/common/styles.css`; none of it is a Tailwind utility, because a consumer's Tailwind build
 * does not scan `node_modules/@starci/grammar`.
 */

/** Identifies the readable Markdown document frame. */
export const markdownArticleClassName = cn("starci-core-markdown-article") ?? "starci-core-markdown-article"
/** Identifies a bounded fenced-code frame. */
export const fencedCodeBlockClassName = cn("starci-core-fenced-code-block") ?? "starci-core-fenced-code-block"
/** Identifies the optional fenced-code header. */
export const fencedCodeHeaderClassName = cn("starci-core-fenced-code-header") ?? "starci-core-fenced-code-header"
/** Identifies the bounded table overflow frame. */
export const markdownTableFrameClassName = cn("starci-core-markdown-table-frame") ?? "starci-core-markdown-table-frame"

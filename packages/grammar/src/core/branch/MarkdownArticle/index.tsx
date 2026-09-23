import type { ReactNode } from "react"
import { fencedCodeBlockClassName, fencedCodeHeaderClassName, markdownArticleClassName, markdownTableFrameClassName } from "./classNames.js"

export type MarkdownArticleProps = {
    readonly children: ReactNode
    readonly ariaLabel?: string
    readonly measure?: "reading" | "compact"
}

type FencedCodeBlockFrameProps = {
    readonly language?: string
    readonly action?: ReactNode
    /**
     * Accessible name of the scrolling code region (e.g. "Install command"). Defaults to
     * `language`. Authored code scrolls inline and is plain text, so its `<pre>` is a Tab stop
     * (WCAG 2.1.1); a name makes it a `role="region"` a screen reader can announce.
     */
    readonly label?: string
}

type AuthoredCodeProps = {
    readonly code: string
    readonly children?: never
}

type RenderedCodeProps = {
    readonly children: ReactNode
    readonly code?: never
}

export type FencedCodeBlockProps = FencedCodeBlockFrameProps & (AuthoredCodeProps | RenderedCodeProps)

export type MarkdownTableFrameProps = {
    readonly children: ReactNode
    /** Accessible name of the scrolling frame; with it the frame is a `role="region"`. */
    readonly label?: string
}

/** Keyboard reachability for an inline-scrolling reading frame whose content is plain text. */
const scrollFrameProps = (label: string | undefined) => ({
    tabIndex: 0,
    ...(label === undefined ? {} : { role: "region", "aria-label": label }),
})

/** Own the business-neutral reading rhythm for one semantic Markdown document. */
export const MarkdownArticle = (props: MarkdownArticleProps) => (
    <div
        aria-label={props.ariaLabel}
        className={markdownArticleClassName}
        data-grammar-markdown-measure={props.measure ?? "reading"}
    >
        {props.children}
    </div>
)

/** Own bounded code overflow while allowing a caller-supplied neutral action such as Copy. */
export const FencedCodeBlock = (props: FencedCodeBlockProps) => {
    const body = "children" in props ? props.children : <pre {...scrollFrameProps(props.label ?? props.language)}><code>{props.code}</code></pre>
    return (
        <div
            className={fencedCodeBlockClassName}
            data-contract="OVERFLOW-4"
        >
            {props.language === undefined && props.action === undefined ? null : (
                <div className={fencedCodeHeaderClassName}>
                    {props.language === undefined ? <span /> : <span>{props.language}</span>}
                    {props.action}
                </div>
            )}
            {body}
        </div>
    )
}

/** Keep a vendor-rendered table inside the same bounded reading frame as semantic tables. */
export const MarkdownTableFrame = (props: MarkdownTableFrameProps) => (
    <div
        className={markdownTableFrameClassName}
        data-contract="OVERFLOW-4"
        {...scrollFrameProps(props.label)}
    >
        {props.children}
    </div>
)

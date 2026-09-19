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
}

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
    const body = "children" in props ? props.children : <pre><code>{props.code}</code></pre>
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
    >
        {props.children}
    </div>
)

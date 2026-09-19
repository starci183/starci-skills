import { cn } from "@heroui/react"
import type { ReactNode } from "react"

export type MediaFrameProps = {
    readonly children: ReactNode
    readonly caption?: ReactNode
    readonly aspect?: "landscape" | "portrait" | "square" | "auto"
    readonly fit?: "cover" | "contain"
    readonly treatment?: "framed" | "plain"
    readonly className?: string
}

/**
 * Product-family frame for an approved illustration, photograph or generated bitmap.
 * Asset purpose and generation authority stay with the consuming product workflow.
 */
export const MediaFrame = ({
    children,
    caption,
    aspect = "landscape",
    fit = "cover",
    treatment = "framed",
    className,
}: MediaFrameProps) => (
    <figure
        className={cn("starci-core-media-frame", className)}
        data-contract="GAP-2 MARGIN-0"
        data-grammar-media-aspect={aspect}
        data-grammar-media-fit={fit}
        data-grammar-media-treatment={treatment}
    >
        <div
            className="starci-core-media-viewport"
            data-contract={treatment === "plain" ? "OVERFLOW-2 SURFACE-1" : "OVERFLOW-2 BOUNDARY-5 SURFACE-3"}
            data-grammar-media="true"
        >{children}</div>
        {caption === undefined ? null : <figcaption className="starci-core-media-caption" data-contract="FLOW-3">{caption}</figcaption>}
    </figure>
)

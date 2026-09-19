import { Card } from "@heroui/react"
import { useId, type ReactNode } from "react"
import { assertPresentationState, treatmentFor, type PresentationState } from "../../state.js"
import { VerticalScrollRegion } from "../../composite/VerticalScrollRegion/index.js"
import { Label } from "../../primitive/Label/index.js"
import {
    getSurfaceCardClassName,
    getSurfaceContentClassName,
    getSurfaceFrameClassName,
    surfaceHighlightClassName,
    surfaceHighlightSweepClassName,
    surfaceLabelClassName,
    type SurfaceCardHeight,
    type SurfaceCardMeasure,
} from "./classNames.js"

export type WholeCardAction =
    | {
        readonly kind: "link"
        readonly href: string
        readonly label: string
    }
    | {
        readonly kind: "button"
        readonly press: () => void
        readonly label: string
    }

type LabelledSurfaceCard = {
    readonly label: string
    readonly ariaLabel?: string
}

type SelfNamedSurfaceCard = {
    readonly label?: undefined
    /** Optional when the surrounding semantic owner already names this purely visual boundary. */
    readonly ariaLabel?: string
}

export type SurfaceCardProps = (LabelledSurfaceCard | SelfNamedSurfaceCard) & {
    readonly children: ReactNode
    readonly fact?: string
    /** Optional content at the end of the external label row. It takes the fact's single place. */
    readonly labelEnd?: ReactNode
    readonly depth?: "top" | "nested"
    readonly state?: PresentationState
    readonly wholeAction?: WholeCardAction
    /** Frameless content already owns its visible boundaries, so Core must not draw another shell. */
    readonly frame?: "bounded" | "frameless"
    /** Contained content has exactly one internal scroll owner. */
    readonly scroll?: "page" | "contained"
    /** Convenience capability: make the content region a HeroUI Vertical ScrollShadow. */
    readonly isScrollable?: boolean
    /** One inset block or multiple touching child faces separated inside the card. */
    readonly composition?: "single" | "joined"
    /** Grammar-owned width contract for ordinary content or compact form surfaces. */
    readonly measure?: SurfaceCardMeasure
    /** Let a peer grid stretch the complete surface anatomy without consumer descendant selectors. */
    readonly height?: SurfaceCardHeight
    /** Draw one legacy accent sweep behind this surface; use for one featured card only. */
    readonly isHighlight?: boolean
}

export const SurfaceCard = (props: SurfaceCardProps) => {
    const {
        label,
        ariaLabel,
        children,
        fact,
        labelEnd,
        depth = "top",
        state = "neutral",
        wholeAction,
        frame = "bounded",
        scroll = "page",
        isScrollable = false,
        composition = "single",
        measure = "content",
        height = "auto",
        isHighlight = false,
    } = props
    assertPresentationState(state)
    const headingId = useId()
    const treatment = treatmentFor(state)
    const disabled = state === "unavailable" || state === "pending"
    const accessibleName = ariaLabel ?? label
    const contained = isScrollable || scroll === "contained"

    /*
     * The inset is drawn on the CONTENT REGION, not on the surface shell, so its claim rides the
     * element whose shipped rule backs it. The shell keeps what it actually paints: its ground, its
     * clipping and its boundary.
     *
     * A frameless surface takes NO inset, and says so. `frame="frameless"` means the content already
     * owns its visible boundaries, so Core must not draw another shell - and the shipped sheet drops
     * the inset with the frame (`.starci-core-frameless-surface > .starci-core-surface-content {
     * padding: 0 }`). PADDING-0 is how the family answers "no inset" everywhere else: on this same
     * body under `composition="joined"`, on SurfaceListCard's root and on SurfaceAccordionCard's
     * panel. The render is unchanged; only the promise now matches it.
     */
    const compositionContract = composition === "joined"
        ? "GAP-0 PADDING-0"
        : frame === "frameless" ? "PADDING-0" : "PADDING-4"
    /*
     * One node, one overflow answer. The frameless shell paints `overflow: visible` and the bounded
     * shell paints `overflow: hidden`; a node that claimed both said the surface clips and does not
     * clip at once, and an audit measuring it could only ever find one of the two true.
     */
    const contentContract = [
        frame === "frameless" ? "SURFACE-1" : "SURFACE-2",
        frame === "frameless" ? "OVERFLOW-1" : "OVERFLOW-2",
        depth === "nested" ? "BOUNDARY-5" : "BOUNDARY-6",
    ].join(" ")
    const rootContract = wholeAction === undefined ? undefined : "SURFACE-4"

    const action = wholeAction?.kind === "link" ? (
        <a
            aria-disabled={disabled || undefined}
            aria-label={wholeAction.label}
            data-grammar-whole-action="link"
            href={disabled ? undefined : wholeAction.href}
            tabIndex={disabled ? -1 : undefined}
        />
    ) : wholeAction?.kind === "button" ? (
        <button
            aria-label={wholeAction.label}
            data-grammar-whole-action="button"
            disabled={disabled}
            onClick={wholeAction.press}
            type="button"
        />
    ) : null

    const surface = (
        <Card.Content
            aria-label={label === undefined ? accessibleName : undefined}
            aria-labelledby={label === undefined ? undefined : headingId}
            className={getSurfaceFrameClassName(frame) ?? ""}
            data-contract={contentContract}
            data-grammar-frame={frame}
            data-grammar-surface-composition={composition}
            data-grammar-surface-height={height}
            data-grammar-scroll={contained ? "contained" : "page"}
            data-grammar-state={state}
            data-grammar-surface-depth={depth}
            data-grammar-treatment={treatment.tone}
        >
            <VerticalScrollRegion
                className={getSurfaceContentClassName(measure, contained)}
                data-contract={compositionContract}
                data-grammar-surface-content="true"
                data-grammar-surface-composition={composition}
                isScrollable={contained}
            >
                {children}
            </VerticalScrollRegion>
            {action}
        </Card.Content>
    )
    const highlightedSurface = isHighlight && state !== "pending" ? (
        <div className={surfaceHighlightClassName} data-grammar-highlight="true">
            <div aria-hidden className={surfaceHighlightSweepClassName} />
            {surface}
        </div>
    ) : surface

    return (
        <Card.Root
            className={getSurfaceCardClassName(measure, height) ?? ""}
            data-contract={rootContract}
            data-grammar-frame={frame}
            data-grammar-surface-composition={composition}
            data-grammar-surface-height={height}
            data-grammar-interaction={wholeAction === undefined ? "static" : "whole-action"}
            data-grammar-surface-labelled={label === undefined ? "false" : "true"}
            data-grammar-surface-card="true"
            render={(cardProps) => <section {...cardProps} />}
            variant="transparent"
        >
            {label === undefined ? null : (
                <Card.Header className={surfaceLabelClassName ?? ""} data-contract="GAP-2" data-grammar-surface-label="true">
                    <Label as="h3" id={headingId}>{label}</Label>
                    {labelEnd ?? (fact === undefined ? null : <span>{fact}</span>)}
                </Card.Header>
            )}
            {highlightedSurface}
        </Card.Root>
    )
}

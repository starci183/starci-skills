import { Card } from "@heroui/react"
import { useId, type ReactNode } from "react"
import { assertPresentationState, treatmentFor, type PresentationState } from "../../state.js"
import { VerticalScrollRegion } from "../../composite/VerticalScrollRegion/index.js"
import { DEFAULT_SURFACE_HEADING_LEVEL, Label, type SurfaceHeadingLevel } from "../../primitive/Label/index.js"
import {
    getSurfaceCardClassName,
    getSurfaceContentClassName,
    getSurfaceFrameClassName,
    surfaceHighlightClassName,
    surfaceHighlightSweepClassName,
    surfaceLabelClassName,
    surfaceArtworkClassName,
    surfaceOrbitClassName,
    type SurfaceCardHeight,
    type SurfaceCardMeasure,
    type SurfaceCardMotif,
    type SurfaceCardTreatment,
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

/** The ordinary light surface: no artwork slot, no motif. */
type PlainSurfaceCard = {
    readonly treatment?: "surface"
    readonly artwork?: undefined
    readonly motif?: undefined
}

/**
 * The ink band: the page's one signature overview moment (DISCIPLINE-3), painted on the family's brand
 * ink (Core: the accent fill and its foreground; Offset Pop: its ink and canvas). Its content re-binds
 * foreground, muted, separator and the soft tone pairs onto the ink, so grammar children keep their
 * own anatomy and stay AA.
 */
type InkSurfaceCard = {
    readonly treatment: "ink"
    /**
     * Decorative art (an `Image` / `MediaFrame` carrying its `assetSlot`). The slot is `aria-hidden`,
     * inert to the pointer, sits behind the content and may bleed off the band's top and inline-end
     * edges; below a 48rem band it drops into the head zone in flow, so it never covers text.
     */
    readonly artwork?: ReactNode
    /** Decorative motif in the artwork zone: `orbit` draws thin rings with nodes (static SVG, low contrast). */
    readonly motif?: SurfaceCardMotif
}

export type SurfaceCardProps = (LabelledSurfaceCard | SelfNamedSurfaceCard) & (PlainSurfaceCard | InkSurfaceCard) & {
    readonly children: ReactNode
    readonly fact?: string
    /** Optional content at the end of the external label row. It takes the fact's single place. */
    readonly labelEnd?: ReactNode
    readonly depth?: "top" | "nested"
    /**
     * Outline rank of the visible `label` (default 3). Pick the rank below the nearest heading
     * above this surface so the page never skips a level.
     */
    readonly headingLevel?: SurfaceHeadingLevel
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
    /** Draw one accent sweep behind this surface; use for one featured card only. */
    readonly isHighlight?: boolean
}

/**
 * The orbit motif: three thin concentric rings with five small nodes, one static SVG. It is drawn in the
 * artwork zone only (never behind body copy), in the ink band's orbit colour (the ink foreground at 20%),
 * and never animates, so reduced motion has nothing to stop.
 */
const OrbitMotif = () => (
    <svg
        aria-hidden="true"
        className={surfaceOrbitClassName}
        data-grammar-surface-orbit="true"
        focusable="false"
        preserveAspectRatio="xMidYMid meet"
        viewBox="0 0 480 320"
    >
        <ellipse cx="264" cy="168" rx="216" ry="118" />
        <ellipse cx="264" cy="168" rx="150" ry="80" />
        <ellipse cx="264" cy="168" rx="84" ry="44" />
        <circle cx="48" cy="168" r="4" />
        <circle cx="420" cy="86" r="3.5" />
        <circle cx="160" cy="236" r="3.5" />
        <circle cx="370" cy="226" r="3" />
        <circle cx="196" cy="140" r="2.5" />
    </svg>
)

export const SurfaceCard = (props: SurfaceCardProps) => {
    const {
        label,
        ariaLabel,
        children,
        fact,
        labelEnd,
        depth = "top",
        headingLevel = DEFAULT_SURFACE_HEADING_LEVEL,
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
    const treatment: SurfaceCardTreatment = props.treatment ?? "surface"
    const motif: SurfaceCardMotif = props.treatment === "ink" ? props.motif ?? "none" : "none"
    const artwork = props.treatment === "ink" ? props.artwork : undefined
    assertPresentationState(state)
    const headingId = useId()
    const stateTreatment = treatmentFor(state)
    const disabled = state === "unavailable" || state === "pending"
    const accessibleName = ariaLabel ?? label
    /* The ink band IS a painted ground, so it is always a bounded shell. */
    const shell = treatment === "ink" ? "bounded" : frame
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
        : shell === "frameless" ? "PADDING-0" : "PADDING-4"
    /*
     * One node, one overflow answer. The frameless shell paints `overflow: visible` and the bounded
     * shell paints `overflow: hidden`; a node that claimed both said the surface clips and does not
     * clip at once, and an audit measuring it could only ever find one of the two true.
     */
    const contentContract = [
        shell === "frameless" ? "SURFACE-1" : "SURFACE-2",
        shell === "frameless" ? "OVERFLOW-1" : "OVERFLOW-2",
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
            className={getSurfaceFrameClassName(shell) ?? ""}
            data-contract={contentContract}
            data-grammar-frame={shell}
            data-grammar-surface-composition={composition}
            data-grammar-surface-height={height}
            data-grammar-scroll={contained ? "contained" : "page"}
            data-grammar-state={state}
            data-grammar-surface-depth={depth}
            data-grammar-treatment={stateTreatment.tone}
            data-grammar-surface-treatment={treatment}
            data-grammar-surface-artwork={artwork !== undefined ? "art" : motif !== "none" ? "motif" : "none"}
        >
            {treatment === "ink" && (artwork !== undefined || motif !== "none") ? (
                <div
                    aria-hidden="true"
                    className={surfaceArtworkClassName}
                    data-grammar-surface-artwork={artwork === undefined ? "none" : "art"}
                    data-grammar-surface-motif={motif}
                >
                    {motif === "orbit" ? <OrbitMotif /> : null}
                    {artwork}
                </div>
            ) : null}
            <VerticalScrollRegion
                className={getSurfaceContentClassName(measure, contained)}
                data-contract={compositionContract}
                data-grammar-surface-content="true"
                data-grammar-surface-composition={composition}
                isScrollable={contained}
                {...(contained ? (label === undefined ? (accessibleName === undefined ? {} : { "aria-label": accessibleName }) : { "aria-labelledby": headingId }) : {})}
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
            className={getSurfaceCardClassName(measure) ?? ""}
            data-contract={rootContract}
            data-grammar-frame={shell}
            data-grammar-surface-composition={composition}
            data-grammar-surface-height={height}
            data-grammar-interaction={wholeAction === undefined ? "static" : "whole-action"}
            data-grammar-surface-labelled={label === undefined ? "false" : "true"}
            data-grammar-surface-card="true"
            data-grammar-surface-treatment={treatment}
            data-component="SurfaceCard"
            data-tier="branch"
            render={(cardProps) => <section {...cardProps} />}
            variant="transparent"
        >
            {label === undefined ? null : (
                <Card.Header className={surfaceLabelClassName ?? ""} data-contract="GAP-2" data-grammar-surface-label="true">
                    <Label as={`h${headingLevel}`} id={headingId}>{label}</Label>
                    {labelEnd ?? (fact === undefined ? null : <span>{fact}</span>)}
                </Card.Header>
            )}
            {highlightedSurface}
        </Card.Root>
    )
}

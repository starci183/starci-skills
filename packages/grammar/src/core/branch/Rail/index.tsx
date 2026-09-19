import { useId, type ReactNode } from "react"
import { assertPresentationState, treatmentFor, type PresentationState } from "../../state.js"
import { railBodyClassName, railClassName, railFooterClassName, railFrameClassName } from "./classNames.js"

type ComplementaryRailProps = {
    readonly label: string
    readonly landmark?: "complementary"
}

type ContentNavigationRailProps = {
    readonly label?: never
    /** The child owns the single navigation landmark; Core must not wrap it in another landmark. */
    readonly landmark: "content-navigation"
}

export type RailProps = (ComplementaryRailProps | ContentNavigationRailProps) & {
    readonly children: ReactNode
    readonly footer?: ReactNode
    /** Whether the rail sizes to authored content or fills a height supplied by its layout host. */
    readonly height?: "content" | "fill"
    readonly mode?: "flow" | "sticky"
    readonly width?: "compact" | "standard" | "wide"
    readonly state?: PresentationState
    readonly collapse?: "expanded" | "collapsed"
    readonly motion?: "static" | "animated" | "reduced"
    /** Visually hide the landmark label when children already expose visible headings. */
    readonly isLabelHidden?: boolean
    /** Grammar-owned content inset. `content` is exactly px-3 py-6. */
    readonly inset?: "none" | "content"
}

export const Rail = (props: RailProps) => {
    const {
        label,
        landmark = "complementary",
        children,
        footer,
        height = "content",
        mode = "flow",
        width = "standard",
        state = "neutral",
        collapse = "expanded",
        motion = "static",
        isLabelHidden = false,
        inset = "none",
    } = props
    assertPresentationState(state)
    const headingId = useId()
    const treatment = treatmentFor(state)

    const bodyContract = [
        // The compact `.75rem` reflow only fires below the rail's own 18rem container
        // breakpoint, which no prop resolves; that variant is not claimed.
        // At height="fill" the body switches from `overflow-y: auto` to `overflow: hidden`,
        // so OVERFLOW-3 no longer describes it; MEASURE-6 ("the rail body fills its shell")
        // takes over instead.
        height === "fill" ? "MEASURE-6" : "OVERFLOW-3",
        inset === "content" ? "PADDING-3 PADDING-5" : null,
    ].filter(Boolean).join(" ")

    const frame = (
        <div className={railFrameClassName} data-contract="GAP-4" data-grammar-rail-frame="true">
            {landmark === "content-navigation" ? null : <h2 className={isLabelHidden ? "starci-core-visually-hidden" : undefined} data-grammar-rail-heading="true" id={headingId}>{label}</h2>}
            <div
                className={railBodyClassName}
                data-grammar-rail-body="true"
                data-grammar-rail-inset={inset}
                {...(bodyContract === "" ? {} : { "data-contract": bodyContract })}
            >{children}</div>
            {footer === undefined ? null : (
                <div className={railFooterClassName} data-grammar-rail-footer="true">{footer}</div>
            )}
        </div>
    )
    const shared = {
        className: railClassName,
        "data-grammar-collapse": collapse,
        "data-grammar-landmark": landmark,
        "data-grammar-rail-height": height,
        "data-grammar-motion": motion,
        "data-grammar-rail": "true",
        "data-grammar-rail-mode": mode,
        "data-grammar-rail-width": width,
        "data-grammar-state": state,
        "data-grammar-treatment": treatment.tone,
    } as const

    if (landmark === "content-navigation") return <div {...shared}>{frame}</div>
    return (
        <aside
            aria-labelledby={headingId}
            {...shared}
        >
            {frame}
        </aside>
    )
}

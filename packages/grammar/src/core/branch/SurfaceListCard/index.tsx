import { Children, useId, type ReactNode } from "react"
import type { RowVerdict } from "../../composite/StaticStateRow/index.js"
import { VerticalScrollRegion } from "../../composite/VerticalScrollRegion/index.js"
import { DEFAULT_SURFACE_HEADING_LEVEL, Label, type SurfaceHeadingLevel } from "../../primitive/Label/index.js"
import { collectionClassName, listShellClassName, surfaceFactClassName, surfaceFooterClassName, surfaceLabelClassName, surfaceListClassName } from "./classNames.js"

type LabelledSurfaceList = {
    readonly label: string
    readonly ariaLabel?: string
}

type SelfNamedSurfaceList = {
    readonly label?: undefined
    readonly ariaLabel: string
}

type SurfaceListFrameProps = (LabelledSurfaceList | SelfNamedSurfaceList) & {
    readonly fact?: string
    readonly labelEnd?: ReactNode
    readonly labelHidden?: boolean
    readonly footer?: ReactNode
    readonly depth?: "top" | "nested"
    /**
     * Outline rank of the visible `label` (default 3). Pick the rank below the nearest heading
     * above this surface so the page never skips a level.
     */
    readonly headingLevel?: SurfaceHeadingLevel
    readonly isLoading?: boolean
    /**
     * The collection reports outcomes: it squares its corners and paints each row's verdict edge.
     *
     * A row opts into that edge by carrying `data-verdict="success" | "danger"` - the slot contract
     * this card publishes for its collection. `StaticStateRow` takes a `verdict` prop that emits it;
     * an application-owned row spells the attribute itself and gets exactly the same shipped edge,
     * because rows here are the caller's children and no prop of this card can reach them.
     */
    readonly isVerdict?: boolean
    readonly isScrollable?: boolean
}

/** The value a row in a verdict collection puts in `data-verdict`. */
export type SurfaceListRowVerdict = RowVerdict

export type SurfaceListCardProps = SurfaceListFrameProps & {
    /**
     * The rows: `<li>` elements (`StaticStateRow`, or an app-owned `<li>`). The collection is the
     * list - a `<ul role="list">`, or the scroll region with `role="list"` when `isScrollable` - so
     * every row has a real list parent and the list is announced with its item count.
     */
    readonly children?: ReactNode
    /**
     * What the card shows when it has no rows (e.g. an `EmptyNotice`). It is drawn in the same
     * collection slot but as plain content, not as a list, because a notice is not a list item.
     */
    readonly empty?: ReactNode
}

export const SurfaceListCard = (props: SurfaceListCardProps) => {
    const {
        label,
        ariaLabel,
        children,
        empty,
        fact,
        labelEnd,
        labelHidden = false,
        footer,
        depth = "top",
        headingLevel = DEFAULT_SURFACE_HEADING_LEVEL,
        isLoading = false,
        isVerdict = false,
        isScrollable = false,
    } = props
    const headingId = useId()
    const accessibleName = ariaLabel ?? label
    const isEmpty = empty !== undefined && Children.toArray(children).length === 0
    const collectionSemantics = isEmpty
        ? {}
        : isScrollable
            ? { role: "list", ...(!labelHidden && label !== undefined ? { "aria-labelledby": headingId } : accessibleName === undefined ? {} : { "aria-label": accessibleName }) }
            : { as: "ul" as const, role: "list" }

    return (
        <section
            className={surfaceListClassName}
            data-grammar-label-visibility={labelHidden ? "hidden" : "visible"}
            data-grammar-surface-list="true"
            data-grammar-surface-depth={depth}
        >
            {label === undefined || labelHidden ? null : (
                <div className={surfaceLabelClassName} data-contract="GAP-2" data-grammar-surface-label="true">
                    <Label as={`h${headingLevel}`} id={headingId} depth={depth}>{label}</Label>
                    {labelEnd ?? (fact === undefined ? null : (
                        <span
                            className={surfaceFactClassName}
                            data-grammar-surface-depth={depth}
                            data-contract={`TONE-2 ${depth === "nested" ? "FONT-1" : "FONT-2"}`}
                        >
                            {fact}
                        </span>
                    ))}
                </div>
            )}
            <div
                aria-label={labelHidden || label === undefined ? accessibleName : undefined}
                aria-labelledby={!labelHidden && label !== undefined ? headingId : undefined}
                className={listShellClassName}
                data-contract="SURFACE-2 PADDING-0 OVERFLOW-2"
                data-grammar-surface="true"
                data-grammar-scroll={isScrollable ? "contained" : "page"}
                data-grammar-surface-depth={depth}
                data-surface-context={depth === "nested" ? "nested" : "page"}
                data-verdict={String(isVerdict)}
            >
                <VerticalScrollRegion
                    {...collectionSemantics}
                    className={collectionClassName}
                    data-grammar-collection={isVerdict ? "verdict" : "list"}
                    data-grammar-list="true"
                    data-loading={String(isLoading)}
                    isScrollable={isScrollable}
                >
                    {isEmpty ? empty : children}
                </VerticalScrollRegion>
            </div>
            {footer === undefined ? null : (
                <div className={surfaceFooterClassName} data-grammar-surface-footer="true">{footer}</div>
            )}
        </section>
    )
}

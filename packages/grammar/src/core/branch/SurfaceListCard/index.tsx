import { useId, type ReactNode } from "react"
import type { RowVerdict } from "../../composite/StaticStateRow/index.js"
import { VerticalScrollRegion } from "../../composite/VerticalScrollRegion/index.js"
import { Label } from "../../primitive/Label/index.js"
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
    readonly children: ReactNode
}

export const SurfaceListCard = (props: SurfaceListCardProps) => {
    const {
        label,
        ariaLabel,
        children,
        fact,
        labelEnd,
        labelHidden = false,
        footer,
        depth = "top",
        isLoading = false,
        isVerdict = false,
        isScrollable = false,
    } = props
    const headingId = useId()
    const accessibleName = ariaLabel ?? label

    return (
        <section
            className={surfaceListClassName}
            data-grammar-label-visibility={labelHidden ? "hidden" : "visible"}
            data-grammar-surface-list="true"
            data-grammar-surface-depth={depth}
        >
            {label === undefined || labelHidden ? null : (
                <div className={surfaceLabelClassName} data-contract="GAP-2" data-grammar-surface-label="true">
                    <Label as="h3" id={headingId} depth={depth}>{label}</Label>
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
                    className={collectionClassName}
                    data-grammar-collection={isVerdict ? "verdict" : "list"}
                    data-grammar-list="true"
                    data-loading={String(isLoading)}
                    isScrollable={isScrollable}
                >
                    {children}
                </VerticalScrollRegion>
            </div>
            {footer === undefined ? null : (
                <div className={surfaceFooterClassName} data-grammar-surface-footer="true">{footer}</div>
            )}
        </section>
    )
}

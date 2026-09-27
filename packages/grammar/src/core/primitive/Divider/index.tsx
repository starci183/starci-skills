import { Text } from "../Text/index.js"

/**
 * How an unlabelled hairline is exposed. `separator` is a thematic break a screen reader announces
 * (`role="separator"`, horizontal); `presentation` is a purely visual seam between faces whose own
 * headings already structure the content, so it is hidden from the accessibility tree.
 */
export type DividerSemantics = "separator" | "presentation"

type LabelledDivider = {
    /** Visible, localized word naming the alternative boundary. */
    readonly label: string
    readonly semantics?: undefined
}

type UnlabelledDivider = {
    readonly label?: undefined
    /** Default `separator`. */
    readonly semantics?: DividerSemantics
}

export type DividerProps = LabelledDivider | UnlabelledDivider

/**
 * A labelled alternative boundary ("or") with intrinsic separator semantics, or - without a label - the
 * one-pixel hairline between touching bands (GAP-0 case-1: joined faces of one surface, stacked bands).
 * The unlabelled rule is BOUNDARY-1: a hairline on `--separator`, full width of its container.
 */
export const Divider = (props: DividerProps) => {
    if (props.label === undefined) {
        const semantics = props.semantics ?? "separator"
        return (
            <div
                data-tier="atom"
                data-component="Divider"
                data-grammar-divider="bare"
                data-grammar-divider-semantics={semantics}
                data-contract="BOUNDARY-1"
                className="starci-core-divider-bare"
                {...(semantics === "separator"
                    ? { role: "separator", "aria-orientation": "horizontal" as const }
                    : { role: "presentation", "aria-hidden": true })}
            />
        )
    }
    return (
        <div
            data-tier="atom"
            data-component="Divider"
            data-grammar-divider="labelled"
            role="separator"
            aria-label={props.label}
            data-contract="GAP-3"
            className="starci-core-divider"
        >
            <span aria-hidden="true" data-contract="BOUNDARY-5" className="starci-core-divider-rule" />
            <Text as="span" size="sm" tone="muted">{props.label}</Text>
            <span aria-hidden="true" data-contract="BOUNDARY-5" className="starci-core-divider-rule" />
        </div>
    )
}

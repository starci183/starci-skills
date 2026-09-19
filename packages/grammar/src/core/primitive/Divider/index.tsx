import { Text } from "../Text/index.js"

export type DividerProps = {
    /** Visible, localized word naming the alternative boundary. */
    readonly label: string
}

/** Labelled alternative boundary with intrinsic separator semantics. */
export const Divider = ({ label }: DividerProps) => (
    <div
        data-tier="atom"
        data-component="Divider"
        role="separator"
        aria-label={label}
        data-contract="GAP-3"
        className="starci-core-divider"
    >
        <span aria-hidden="true" data-contract="BOUNDARY-5" className="starci-core-divider-rule" />
        <Text as="span" size="sm" tone="muted">{label}</Text>
        <span aria-hidden="true" data-contract="BOUNDARY-5" className="starci-core-divider-rule" />
    </div>
)

import type { PresentationState } from "./state.js"
import { treatmentFor } from "./state.js"

/** Props for the neutral state mark. */
export type StateMarkProps = {
    readonly state: PresentationState
}

/**
 * Draw the check mark used by successful neutral states.
 *
 * Contract: STATE-1 (the carrier is chosen from the named state through `treatmentFor`) and ICON-6
 * (the mark is decorative, so it is always `aria-hidden`; the state's words carry the meaning).
 */
export const StateMark = (props: StateMarkProps) => {
    const treatment = treatmentFor(props.state)
    if (treatment.mark !== "check") return null

    return (
        <svg
            aria-hidden="true"
            data-contract="STATE-1 ICON-6"
            data-grammar-state-mark="check"
            focusable="false"
            viewBox="0 0 20 20"
        >
            <path d="M5 10.5 8.25 14 15 6.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
        </svg>
    )
}

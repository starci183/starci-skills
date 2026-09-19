import type { PresentationState } from "./state.js"
import { treatmentFor } from "./state.js"

/** Props for the neutral state mark. */
export type StateMarkProps = {
    readonly state: PresentationState
}

/** Draw the check mark used by successful neutral states. */
export const StateMark = (props: StateMarkProps) => {
    const treatment = treatmentFor(props.state)
    if (treatment.mark !== "check") return null

    return (
        <svg
            aria-hidden="true"
            data-grammar-state-mark="check"
            focusable="false"
            viewBox="0 0 20 20"
        >
            <path d="M5 10.5 8.25 14 15 6.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
        </svg>
    )
}

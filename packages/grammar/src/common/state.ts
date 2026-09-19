/** Render-neutral presentation states shared by Grammar components. */
export const PRESENTATION_STATES = [
    "neutral", "informative", "affirmative", "cautionary", "negative", "pending", "unavailable",
] as const

export type PresentationState = (typeof PRESENTATION_STATES)[number]

const stateSet: ReadonlySet<string> = new Set(PRESENTATION_STATES)

export const isPresentationState = (value: unknown): value is PresentationState => (
    typeof value === "string" && stateSet.has(value)
)

export const assertPresentationState: (value: unknown) => asserts value is PresentationState = (value) => {
    if (!isPresentationState(value)) throw new TypeError(`Unknown presentation state: ${JSON.stringify(value)}`)
}

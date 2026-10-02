/** The clock port: business code asks it for the time instead of reading the ambient clock, so a spec can drive time. */
export interface Clock {
    /** The current instant. */
    now(): Date
}

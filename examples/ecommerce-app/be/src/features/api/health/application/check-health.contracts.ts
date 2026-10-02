import type { Outcome } from "@modules/platform/primitives"
import type { ProbeReport, ProbesErrorCode } from "@modules/platform/probes"

/** Checking health takes no input. */
export type CheckHealthRequest = Readonly<Record<string, never>>

/** The dependency states when every dependency answers, or the refusal naming the state of each. */
export type CheckHealthResult = Outcome<ProbeReport, ProbesErrorCode.DependencyUnavailable>

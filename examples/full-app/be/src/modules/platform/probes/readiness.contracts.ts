import type { Outcome } from "@modules/platform/primitives"
import type { ProbesErrorCode } from "./errors/probes.error"
import type { ProbeReport } from "./probes.contracts"

/** The dependency report after the bounded required-dependency probe succeeds. */
export type ReadinessReport = Outcome<ProbeReport, ProbesErrorCode.DependencyUnavailable>

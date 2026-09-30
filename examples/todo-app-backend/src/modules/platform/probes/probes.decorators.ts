import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { ProbeChecker } from "./probe-checker.service"
import type { ProbesOptions } from "./probes.options"
import type { Probe } from "./probes.port"

/** Token of the probes options, exported so a spec can provide it. */
export const PROBES_OPTIONS: unique symbol = Symbol("platform.probes.options")

/** Token of the ProbeChecker. */
export const PROBE_CHECKER: unique symbol = Symbol("platform.probes.checker")

/** Token of the list of Probe instances this app reports on. */
export const PROBES: unique symbol = Symbol("platform.probes.probes")

/** Injects the options of the probes capability. Parameter type: ProbesOptions. */
export const InjectProbesOptions = (): TypedParameterDecorator<ProbesOptions> =>
    injector<ProbesOptions>(PROBES_OPTIONS)

/** Injects the probes this app reports on. Parameter type: ReadonlyArray of Probe. */
export const InjectProbes = (): TypedParameterDecorator<ReadonlyArray<Probe>> =>
    injector<ReadonlyArray<Probe>>(PROBES)

/** Injects the probe checker. Parameter type: ProbeChecker. */
export const InjectProbeChecker = (): TypedParameterDecorator<ProbeChecker> =>
    injector<ProbeChecker>(PROBE_CHECKER)

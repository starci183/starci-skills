import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { ProbeCheckerService } from "./probe-checker.service"
import { MODULE_OPTIONS_TOKEN } from "./probes.module-definition"
import type { ProbesOptions } from "./probes.options"
import type { Probe } from "./probes.port"

/** Token of the options of this capability, the token its configurable module provides them under. */
export const PROBES_OPTIONS: typeof MODULE_OPTIONS_TOKEN = MODULE_OPTIONS_TOKEN

/** Token of the ProbeCheckerService. */
export const PROBE_CHECKER: unique symbol = Symbol("platform.probes.checker")

/** Token of the list of Probe instances this app reports on. */
export const PROBES: unique symbol = Symbol("platform.probes.probes")

/** Injects the options of the probes capability. Parameter type: ProbesOptions. */
export const InjectProbesOptions = (): TypedParameterDecorator<ProbesOptions> => injector<ProbesOptions>(PROBES_OPTIONS)

/** Injects the probes this app reports on. Parameter type: ReadonlyArray of Probe. */
export const InjectProbes = (): TypedParameterDecorator<ReadonlyArray<Probe>> => injector<ReadonlyArray<Probe>>(PROBES)

/** Injects the probe checker. Parameter type: ProbeCheckerService. */
export const InjectProbeChecker = (): TypedParameterDecorator<ProbeCheckerService> =>
    injector<ProbeCheckerService>(PROBE_CHECKER)

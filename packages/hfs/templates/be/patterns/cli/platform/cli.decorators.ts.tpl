import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { CliRegistry, CliRunner } from "./cli.port"

/** Token of the registry a command registers with. */
export const CLI_REGISTRY: unique symbol = Symbol("platform.cli.registry")

/** Token of the runner the app entry calls. */
export const CLI_RUNNER: unique symbol = Symbol("platform.cli.runner")

/** Injects the command registry. Parameter type: CliRegistry. */
export const InjectCliRegistry = (): TypedParameterDecorator<CliRegistry> => injector<CliRegistry>(CLI_REGISTRY)

/** Injects the runner. Parameter type: CliRunner. */
export const InjectCliRunner = (): TypedParameterDecorator<CliRunner> => injector<CliRunner>(CLI_RUNNER)

import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import { MODULE_OPTIONS_TOKEN } from "./messaging.module-definition"
import type { MessagingOptions } from "./messaging.options"
import type { ConsumerRegistry } from "./messaging.port"

/** Token of the messaging options, exported so a spec can provide it. */
export const MESSAGING_OPTIONS = MODULE_OPTIONS_TOKEN

/** Token of the consumer registry. */
export const CONSUMER_REGISTRY: unique symbol = Symbol("platform.messaging.consumer-registry")

/** Injects the options of the messaging capability. Parameter type: MessagingOptions. */
export const InjectMessagingOptions = (): TypedParameterDecorator<MessagingOptions> =>
    injector<MessagingOptions>(MESSAGING_OPTIONS)

/** Injects the consumer registry. Parameter type: ConsumerRegistry. */
export const InjectConsumerRegistry = (): TypedParameterDecorator<ConsumerRegistry> =>
    injector<ConsumerRegistry>(CONSUMER_REGISTRY)

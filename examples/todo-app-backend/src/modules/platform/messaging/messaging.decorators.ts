import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import { MODULE_OPTIONS_TOKEN } from "./messaging.module-definition"
import type { MessagingOptions } from "./messaging.options"
import type { ConsumerRegistry, MessagePublisher } from "./messaging.port"

/** Token of the MessagePublisher port. */
export const MESSAGE_PUBLISHER: unique symbol = Symbol("platform.messaging.publisher")

/** Token of the consumer registry. */
export const CONSUMER_REGISTRY: unique symbol = Symbol("platform.messaging.consumer-registry")

/** Injects the options of the messaging capability. Parameter type: MessagingOptions. */
export const InjectMessagingOptions = (): TypedParameterDecorator<MessagingOptions> =>
    injector<MessagingOptions>(MODULE_OPTIONS_TOKEN)

/** Injects the MessagePublisher port. Parameter type: MessagePublisher. */
export const InjectMessagePublisher = (): TypedParameterDecorator<MessagePublisher> =>
    injector<MessagePublisher>(MESSAGE_PUBLISHER)

/** Injects the consumer registry. Parameter type: ConsumerRegistry. */
export const InjectConsumerRegistry = (): TypedParameterDecorator<ConsumerRegistry> =>
    injector<ConsumerRegistry>(CONSUMER_REGISTRY)

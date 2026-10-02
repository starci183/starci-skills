import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { Inbox } from "./inbox.port"

/** Token of the Inbox port. */
export const INBOX: unique symbol = Symbol("platform.inbox")

/** Injects the Inbox port. Parameter type: Inbox. */
export const InjectInbox = (): TypedParameterDecorator<Inbox> => injector<Inbox>(INBOX)

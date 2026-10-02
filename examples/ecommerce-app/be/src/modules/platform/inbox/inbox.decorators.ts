import type { EntityManager } from "typeorm"
import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { Inbox } from "./inbox.port"

/** Token of the Inbox port. */
export const INBOX: unique symbol = Symbol("platform.inbox")

/** Token of the entity managers of the connections that hold the claims table, in the order the options name them. */
export const INBOX_MANAGERS: unique symbol = Symbol("platform.inbox.managers")

/** Injects the Inbox port. Parameter type: Inbox. */
export const InjectInbox = (): TypedParameterDecorator<Inbox> => injector<Inbox>(INBOX)

/** Injects the entity managers of the connections that hold the claims table. Parameter type: a one-manager tuple. */
export const InjectInboxManagers = (): TypedParameterDecorator<readonly [EntityManager]> =>
    injector<readonly [EntityManager]>(INBOX_MANAGERS)

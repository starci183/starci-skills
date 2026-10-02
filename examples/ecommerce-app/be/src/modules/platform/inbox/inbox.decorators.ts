import type { EntityManager } from "typeorm"
import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { Inbox } from "./inbox.port"

/** Token of the Inbox port. */
export const INBOX: unique symbol = Symbol("platform.inbox")

/** Token of the entity managers of the connections that hold the claims table, in the order the options name them. */
export const CLAIM_MANAGERS: unique symbol = Symbol("platform.inbox.claim-managers")

/** Injects the Inbox port. Parameter type: Inbox. */
export const InjectInbox = (): TypedParameterDecorator<Inbox> => injector<Inbox>(INBOX)

/** Injects the entity managers of the connections that hold the claims table. Parameter type: a one-manager tuple (`readonly [EntityManager]`). */
export const InjectClaimManagers = (): TypedParameterDecorator<readonly [EntityManager]> =>
    injector<readonly [EntityManager]>(CLAIM_MANAGERS)

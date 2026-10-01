import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { SessionService } from "./session.service"

/** Token of the SessionService of this capability, for the capabilities that use it. */
export const SESSION_SERVICE: unique symbol = Symbol("domain.session.service")

/** Injects the SessionService. Parameter type: SessionService. */
export const InjectSessionService = (): TypedParameterDecorator<SessionService> =>
    injector<SessionService>(SESSION_SERVICE)

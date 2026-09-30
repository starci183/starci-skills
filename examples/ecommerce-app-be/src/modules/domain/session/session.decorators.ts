import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import { SessionService } from "./session.service"

/** Injects the SessionService of this capability. Parameter type: SessionService. */
export const InjectSessionService = (): TypedParameterDecorator<SessionService> => injector<SessionService>(SessionService)

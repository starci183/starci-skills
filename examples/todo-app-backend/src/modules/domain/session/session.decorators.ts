import { SetMetadata, createParamDecorator } from "@nestjs/common"
import type { ExecutionContext } from "@nestjs/common"
import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { Principal, Role } from "@modules/platform/cqrs"
import { requestOf } from "@modules/platform/http-security"
import { SessionError, SessionErrorCode } from "./errors/session.error"
import type { PublicMetadata } from "./session.contracts"
import { MODULE_OPTIONS_TOKEN } from "./session.module-definition"
import type { SessionOptions } from "./session.options"

/** Metadata key of `@Public`. */
export const PUBLIC_KEY = "domain.session.public"

/** Metadata key of `@Roles`. */
export const ROLES_KEY = "domain.session.roles"

/** Injects the options of the session capability. Parameter type: SessionOptions. */
export const InjectSessionOptions = (): TypedParameterDecorator<SessionOptions> =>
    injector<SessionOptions>(MODULE_OPTIONS_TOKEN)

/** Opens a door to anonymous callers, stating why; every other door needs a live session. */
export const Public = (metadata: PublicMetadata): ReturnType<typeof SetMetadata> => SetMetadata(PUBLIC_KEY, metadata)

/** Requires the caller to hold every listed role. */
export const Roles = (...roles: Array<Role>): ReturnType<typeof SetMetadata> => SetMetadata(ROLES_KEY, roles)

/** The authenticated caller of the door; refuses when no guard established one. */
export const CurrentPrincipal = createParamDecorator((_data: unknown, context: ExecutionContext): Principal => {
    const principal = requestOf(context).principal
    if (!principal) throw new SessionError({ code: SessionErrorCode.NotFound })
    return principal
})

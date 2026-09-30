import { SetMetadata, createParamDecorator } from "@nestjs/common"
import type { ExecutionContext } from "@nestjs/common"
import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { Principal, Role } from "@modules/platform/cqrs"
import { requestOf } from "@modules/platform/http-security"
import { bearerTokenOf } from "./bearer-token.mapper"
import { AuthError, AuthErrorCode } from "./errors/auth.error"
import type { PublicMetadata, SessionVerifier } from "./auth.contracts"

/** Metadata key of `@Public`. */
export const PUBLIC_KEY = "domain.auth.public"

/** Metadata key of `@Roles`. */
export const ROLES_KEY = "domain.auth.roles"

/** Token of the SessionVerifier the app composes. */
export const SESSION_VERIFIER: unique symbol = Symbol("domain.auth.session-verifier")

/** Injects the SessionVerifier. Parameter type: SessionVerifier. */
export const InjectSessionVerifier = (): TypedParameterDecorator<SessionVerifier> =>
    injector<SessionVerifier>(SESSION_VERIFIER)

/** Opens a door to anonymous callers, stating why; every other door needs a live session. */
export const Public = (metadata: PublicMetadata): ReturnType<typeof SetMetadata> => SetMetadata(PUBLIC_KEY, metadata)

/** Requires the caller to hold every listed role. */
export const Roles = (...roles: Array<Role>): ReturnType<typeof SetMetadata> => SetMetadata(ROLES_KEY, roles)

/** The authenticated caller of the door; refuses when no guard established one. */
export const CurrentPrincipal = createParamDecorator((_data: unknown, context: ExecutionContext): Principal => {
    const principal = requestOf(context).principal
    if (!principal) throw new AuthError({ code: AuthErrorCode.Unauthenticated })
    return principal
})

/** The bearer token the request presented, for a door that must forward it to another service. */
export const BearerToken = createParamDecorator((_data: unknown, context: ExecutionContext): string => {
    const token = bearerTokenOf(requestOf(context).headers.authorization)
    if (token === null) throw new AuthError({ code: AuthErrorCode.Unauthenticated })
    return token
})

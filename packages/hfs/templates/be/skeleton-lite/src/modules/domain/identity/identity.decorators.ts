import { SetMetadata, createParamDecorator } from "@nestjs/common"
import type { ExecutionContext } from "@nestjs/common"
import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { VerifySupabaseAccessToken } from "@modules/integrations/supabase"
import { requestOf } from "@modules/platform/http-security"
import type { Principal } from "@modules/platform/cqrs"
import { IdentityError, IdentityErrorCode } from "./errors/identity.error"
import type { PublicMetadata } from "./identity.contracts"

/** Token of the access-token verifier the composition root hands to identity. */
export const ACCESS_TOKEN_VERIFIER: unique symbol = Symbol("domain.identity.access-token-verifier")

/** Injects the access-token verifier identity was registered with. Parameter type: VerifySupabaseAccessToken. */
export const InjectAccessTokenVerifier = (): TypedParameterDecorator<VerifySupabaseAccessToken> =>
    injector<VerifySupabaseAccessToken>(ACCESS_TOKEN_VERIFIER)

/** Metadata key of `@Public`. */
export const PUBLIC_KEY = "domain.identity.public"

/** Opens a door to anonymous callers, stating why; every other door needs a verified Supabase session. */
export const Public = (metadata: PublicMetadata): ReturnType<typeof SetMetadata> => SetMetadata(PUBLIC_KEY, metadata)

/** The authenticated Supabase caller established by the default-deny guard. */
export const CurrentPrincipal = createParamDecorator((_data: unknown, context: ExecutionContext): Principal => {
    const principal = requestOf(context).principal
    if (!principal) throw new IdentityError({ code: IdentityErrorCode.Unauthenticated })
    return principal
})

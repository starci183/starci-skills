import { SetMetadata, createParamDecorator } from "@nestjs/common"
import type { ExecutionContext } from "@nestjs/common"
import { requestOf } from "@modules/platform/http-security"
import type { Principal } from "@modules/platform/cqrs"
import { IdentityError, IdentityErrorCode } from "./errors/identity.error"
import type { PublicMetadata } from "./identity.contracts"

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

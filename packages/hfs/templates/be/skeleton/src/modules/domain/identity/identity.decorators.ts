import { SetMetadata } from "@nestjs/common"
import type { PublicMetadata } from "./identity.contracts"

/** Metadata key of `@Public`. */
export const PUBLIC_KEY = "domain.identity.public"

/** Opens a door to anonymous callers, stating why; every other door needs a signed-in caller. */
export const Public = (metadata: PublicMetadata): ReturnType<typeof SetMetadata> => SetMetadata(PUBLIC_KEY, metadata)

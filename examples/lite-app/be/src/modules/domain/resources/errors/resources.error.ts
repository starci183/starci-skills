import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the resources capability. */
export enum ResourcesErrorCode {
    /** No row owned by the authenticated principal has the requested id. */
    NotFound = "RESOURCES_NOT_FOUND",
}

/** How each resources code travels. */
export const RESOURCES_ERROR_KINDS: Record<ResourcesErrorCode, ErrorKind> = {
    [ResourcesErrorCode.NotFound]: "not-found",
}

/** The one error class of the resources capability. */
export class ResourcesError extends DomainError<ResourcesErrorCode> {}

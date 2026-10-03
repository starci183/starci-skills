import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the {{name}} capability. */
export enum {{Name}}ErrorCode {
    /** No row owned by the authenticated principal has the requested id. */
    NotFound = "{{upper}}_NOT_FOUND",
}

/** How each {{name}} code travels. */
export const {{upper}}_ERROR_KINDS: Record<{{Name}}ErrorCode, ErrorKind> = {
    [{{Name}}ErrorCode.NotFound]: "not-found",
}

/** The one error class of the {{name}} capability. */
export class {{Name}}Error extends DomainError<{{Name}}ErrorCode> {}

import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the config capability; both are boot failures that name the offending key in the params. */
export enum ConfigErrorCode {
    /** A required key is not declared in the environment. */
    KeyMissing = "CONFIG_KEY_MISSING",
    /** A declared key does not parse as the type its reader expects. */
    KeyInvalid = "CONFIG_KEY_INVALID",
}

/** How each config code travels. */
export const CONFIG_ERROR_KINDS: Record<ConfigErrorCode, ErrorKind> = {
    [ConfigErrorCode.KeyMissing]: "internal",
    [ConfigErrorCode.KeyInvalid]: "internal",
}

/** The one error class of the config capability. */
export class ConfigError extends DomainError<ConfigErrorCode> {}

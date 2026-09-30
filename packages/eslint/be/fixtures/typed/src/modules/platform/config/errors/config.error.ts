import { DomainError } from "@modules/platform/errors"

/** Codes of the config capability (fixture). */
export enum ConfigErrorCode {
    /** A key is missing. */
    KeyMissing = "CONFIG_KEY_MISSING",
}

/** The one error class of the config capability (fixture). */
export class ConfigError extends DomainError<ConfigErrorCode> {}

import { DomainError } from "@modules/platform/errors"

/** Why a configuration key was refused. */
export type ConfigErrorCode = "CONFIG_KEY_MISSING" | "CONFIG_KEY_INVALID" | "CONFIG_FILE_UNREADABLE"

const REASONS: Readonly<Record<ConfigErrorCode, string>> = {
    CONFIG_KEY_MISSING: "is required and has no default",
    CONFIG_KEY_INVALID: "does not hold a valid value",
    CONFIG_FILE_UNREADABLE: "points at a file that cannot be read",
}

/** Startup configuration refusal: names the key and the rule it broke, never the value it was given. */
export class ConfigError extends DomainError {
    /** The environment key that was refused. */
    readonly key: string

    constructor(code: ConfigErrorCode, key: string, options?: { readonly cause?: unknown }) {
        super(code, `Configuration key ${key} ${REASONS[code]}.`, options)
        this.key = key
    }
}

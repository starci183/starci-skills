import {
    DomainError 
} from "@modules/platform/errors/index"

/** Why a configuration key was refused. */
export type ConfigErrorCode = "CONFIG_KEY_MISSING" | "CONFIG_FILE_UNREADABLE"

const REASONS: Readonly<Record<ConfigErrorCode, string>> = {
    CONFIG_KEY_MISSING: "is required and has no default",
    CONFIG_FILE_UNREADABLE: "points at a file that cannot be read",
}

/** A configuration refusal: names the key and the rule it broke, never the value it was given. */
export class ConfigError extends DomainError {
    /** The environment key that was refused. */
    readonly key: string

    constructor(code: ConfigErrorCode, key: string, cause?: unknown) {
        super(code,
            `Configuration key ${key} ${REASONS[code]}.`,
            {
                cause, metadata: {
                    key 
                } 
            })
        this.key = key
    }
}

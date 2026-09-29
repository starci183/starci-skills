import { readFileSync } from "node:fs"
import { ConfigError } from "./errors/config.error"

type Values = Readonly<Record<string, string | undefined>>

/** The only reader of the process environment. Every key may instead be supplied as `<KEY>_FILE`, a path to its value. */
export class EnvSource {
    private constructor(private readonly values: Values) {}

    /** The live process environment; called once, from `main.ts`. */
    static fromProcess(): EnvSource {
        return new EnvSource(process.env)
    }

    /** A fixed snapshot, for specs and tools. */
    static of(values: Values): EnvSource {
        return new EnvSource(values)
    }

    /** The value of `key`, or `undefined` when it is unset or empty. */
    optional(key: string): string | undefined {
        const path = this.values[`${key}_FILE`]
        if (path !== undefined && path !== "") {
            try {
                return readFileSync(path, "utf8").trim()
            } catch (cause) {
                throw new ConfigError("CONFIG_FILE_UNREADABLE", `${key}_FILE`, { cause })
            }
        }
        const value = this.values[key]
        return value === undefined || value === "" ? undefined : value
    }

    /** The value of `key`; a missing key stops the boot with an error that names it. */
    required(key: string): string {
        const value = this.optional(key)
        if (value === undefined) throw new ConfigError("CONFIG_KEY_MISSING", key)
        return value
    }
}

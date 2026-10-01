import { readFileSync } from "node:fs"
import { ConfigError, ConfigErrorCode } from "./errors/config.error"

const FILE_SUFFIX = "_FILE"
const DURATION_UNITS: Readonly<Record<string, number>> = { ms: 1, s: 1000, m: 60_000, h: 3_600_000 }
const DURATION_PATTERN = /^(\d+)(ms|s|m|h)?$/

/**
 * The only reader of the process environment. Typed readers name the missing or malformed key in the error; a key
 * `<KEY>_FILE` supplies `<KEY>` from a file, so secrets can be mounted instead of exported.
 */
export class EnvSource {
    constructor(private readonly values: Readonly<Record<string, string | undefined>>) {}

    /** Reads the process environment once, resolving every `<KEY>_FILE` into `<KEY>`. */
    static fromProcess(): EnvSource {
        const values: Record<string, string | undefined> = { ...process.env }
        for (const [key, path] of Object.entries(process.env)) {
            if (key.endsWith(FILE_SUFFIX) && path)
                values[key.slice(0, -FILE_SUFFIX.length)] = readFileSync(path, "utf8").trim()
        }
        return new EnvSource(values)
    }

    /** True when the key is declared and not empty. */
    has(key: string): boolean {
        return Boolean(this.values[key])
    }

    /** True when at least one of the keys is declared: the switch of an all-or-nothing optional integration. */
    anyDeclared(keys: ReadonlyArray<string>): boolean {
        return keys.some((key) => this.has(key))
    }

    /** The declared value of an optional key, or undefined. */
    optional(key: string): string | undefined {
        return this.values[key] || undefined
    }

    /** A required string. */
    string(key: string): string {
        const value = this.values[key]
        if (!value) throw new ConfigError({ code: ConfigErrorCode.KeyMissing, params: { key } })
        return value
    }

    /** A required integer, or the literal `fallback` when the key is not declared (tunables only). */
    int(key: string, fallback?: number): number {
        if (!this.has(key) && fallback !== undefined) return fallback
        const value = Number(this.string(key))
        if (!Number.isInteger(value)) throw new ConfigError({ code: ConfigErrorCode.KeyInvalid, params: { key } })
        return value
    }

    /** A required boolean (`true` or `false`), or the literal `fallback` when not declared (tunables only). */
    bool(key: string, fallback?: boolean): boolean {
        if (!this.has(key) && fallback !== undefined) return fallback
        const value = this.string(key)
        if (value !== "true" && value !== "false")
            throw new ConfigError({ code: ConfigErrorCode.KeyInvalid, params: { key } })
        return value === "true"
    }

    /** A required absolute URL, returned as written. */
    url(key: string): string {
        const value = this.string(key)
        if (!URL.canParse(value)) throw new ConfigError({ code: ConfigErrorCode.KeyInvalid, params: { key } })
        return value
    }

    /** A required value that must be one of `allowed`. */
    enum<T extends string>(key: string, allowed: ReadonlyArray<T>): T {
        const value = this.string(key)
        const found = allowed.find((candidate) => candidate === value)
        if (found === undefined) throw new ConfigError({ code: ConfigErrorCode.KeyInvalid, params: { key } })
        return found
    }

    /** A duration in milliseconds: `250`, `250ms`, `30s`, `5m` or `2h`; the literal `fallback` applies when not declared (tunables only). */
    duration(key: string, fallback?: number): number {
        if (!this.has(key) && fallback !== undefined) return fallback
        const match = DURATION_PATTERN.exec(this.string(key))
        const unit = DURATION_UNITS[match?.[2] ?? "ms"]
        if (!match?.[1] || unit === undefined)
            throw new ConfigError({ code: ConfigErrorCode.KeyInvalid, params: { key } })
        return Number(match[1]) * unit
    }
}

/** Fixture stand-in for `platform/config/env-source.ts`. */
export declare class EnvSource {
    static of(values: object): EnvSource
    string(key: string): string
    optional(key: string): string | undefined
}

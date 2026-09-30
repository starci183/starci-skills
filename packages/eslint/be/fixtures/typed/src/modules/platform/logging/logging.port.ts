/** Fixture: the Logger port of platform/logging. */
export interface Logger {
    info(event: string, fields?: Readonly<Record<string, unknown>>): void
    warn(event: string, fields?: Readonly<Record<string, unknown>>): void
    error(event: string, cause: unknown, fields?: Readonly<Record<string, unknown>>): void
}

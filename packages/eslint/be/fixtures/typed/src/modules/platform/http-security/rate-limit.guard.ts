/** The rate-limit tiers a door may take (fixture). */
export enum RateTier {
    /** The global default tier. */
    Default = "default",
    /** The strict tier of handshakes and webhooks. */
    Strict = "strict",
}

/** A lookalike tier enum declared by another shape (fixture). */
export enum Tier {
    /** Looks strict, is not the platform tier. */
    Strict = "strict",
}

/** Fixture: puts a door on a rate-limit tier. */
export const RateLimit = (_tier: RateTier): MethodDecorator & ClassDecorator => () => undefined

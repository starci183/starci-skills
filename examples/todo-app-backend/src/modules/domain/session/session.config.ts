import type { EnvSource } from "@modules/platform/config"
import type { SessionOptions } from "./session.options"

/** Reads the session options: the lifetime is a tunable with a literal default, the administrator roster is optional. */
export const parseSessionConfig = (env: EnvSource): SessionOptions => ({
    ttlDays: env.int("SESSION_TTL_DAYS", 30),
    adminSubjects: (env.optional("SESSION_ADMIN_SUBJECTS") ?? "")
        .split(",")
        .map((subject) => subject.trim())
        .filter(Boolean),
})

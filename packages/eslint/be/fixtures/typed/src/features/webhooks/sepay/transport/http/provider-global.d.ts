/** Fixture: a global type alias makes bus injection available without an import in the linted HTTP module. */
import type { CommandBus } from "@nestjs/cqrs"

declare global {
    type ProviderGlobalBus = CommandBus
}

export {}

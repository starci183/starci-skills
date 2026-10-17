import type { DynamicModule } from "@nestjs/common"
import { IdentityModule } from "@modules/domain/identity"
import { LivenessModule } from "@modules/domain/liveness"
import { NoteModule } from "@modules/domain/note"

/** Domain capabilities shared by the core app. */
export const domainModules = (): Array<DynamicModule> => [
    IdentityModule.register({ isGlobal: true }),
    LivenessModule.register({ isGlobal: true }),
    NoteModule.register({ isGlobal: true }),
]

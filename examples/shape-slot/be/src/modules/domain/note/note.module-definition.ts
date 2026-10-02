import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { NoteOptions } from "./note.options"

/** The configurable-module base of the note capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<NoteOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()

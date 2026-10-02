import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./note.module-definition"
import { NOTE_SERVICE } from "./note.decorators"
import { NoteService } from "./note.service"

@Module({})
/** The note capability over the primary database. */
export class NoteModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), NoteService, { provide: NOTE_SERVICE, useExisting: NoteService }],
            exports: [NOTE_SERVICE],
        }
    }
}

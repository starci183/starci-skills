import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { NoteService } from "./note.service"

/** Token of the NoteService of this capability, for the capabilities that use it. */
export const NOTE_SERVICE: unique symbol = Symbol("domain.note.service")

/** Injects the NoteService. Parameter type: NoteService. */
export const InjectNoteService = (): TypedParameterDecorator<NoteService> => injector<NoteService>(NOTE_SERVICE)

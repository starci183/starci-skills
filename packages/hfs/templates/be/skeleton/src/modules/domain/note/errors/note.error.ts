import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the note capability. */
export enum NoteErrorCode {
    /** The write did not answer the note it should have stored; a defect, never a business refusal. */
    NoteMissing = "NOTE_MISSING",
}

/** How each note code travels. */
export const NOTE_ERROR_KINDS: Record<NoteErrorCode, ErrorKind> = {
    [NoteErrorCode.NoteMissing]: "internal",
}

/** The one error class of the note capability. */
export class NoteError extends DomainError<NoteErrorCode> {}

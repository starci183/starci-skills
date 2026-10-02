import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager, LIST_ROWS_MAX } from "@modules/platform/database"
import type { CreateNoteParams, Note } from "./note.contracts"
import { NoteError, NoteErrorCode } from "./errors/note.error"
import { NoteEntity } from "./persistence/entities/note.entity"
import { toNote } from "./persistence/note.rows"
import type { NoteRow } from "./persistence/note.rows"
import { INSERT_NOTE } from "./persistence/note.sql"

@Injectable()
/** The notes of the app over the primary database: written in the caller transaction, read newest first. */
export class NoteService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /** The newest notes, capped at the list maximum. */
    async list(): Promise<Array<Note>> {
        const rows = await this.entityManager.find(NoteEntity, {
            order: { createdAt: "DESC" },
            take: LIST_ROWS_MAX,
        })
        return rows.map((row) => ({ id: row.id, body: row.body, createdAt: row.createdAt.toISOString() }))
    }

    /** Writes one note in the caller transaction, stamped by the clock, and answers it as stored. */
    async create(params: CreateNoteParams): Promise<Note> {
        const rows: Array<NoteRow> = await params.manager.query(INSERT_NOTE, [params.body, this.clock.now()])
        const note = toNote(rows)
        if (note === null) throw new NoteError({ code: NoteErrorCode.NoteMissing })
        return note
    }
}

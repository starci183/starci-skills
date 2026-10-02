import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectOrderEntityManager } from "@modules/platform/database"
import { InjectInbox } from "@modules/platform/inbox"
import type { Inbox } from "@modules/platform/inbox"
import type {
    BeginSagaParams,
    CompensateSagaParams,
    CompleteSagaParams,
    SagaRun,
    SagaState,
    SagaStatus,
    SagaTransition,
} from "./saga.contracts"
import type { SagaStateRow, SagaVersionRow } from "./persistence/saga.rows"
import { BEGIN_SAGA, MOVE_SAGA, READ_SAGA } from "./persistence/saga.sql"

/** The inbox source of the events that move one saga. */
const sourceOf = (saga: string): string => `saga:${saga}`

@Injectable()
/**
 * The state machine and the fence of every saga of a service. A run is `running` from its first step; the event that reports a
 * failure moves it to `compensating`, runs the compensation and settles it as `compensated`; the event that reports the last
 * step done settles it as `completed`. Every transition names the version it read and moves it by one, so two transitions
 * never both win, and takes its event through the inbox first, so a redelivery changes nothing.
 */
export class SagaService {
    constructor(
        @InjectOrderEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectInbox() private readonly inbox: Inbox,
    ) {}

    /** Starts the run in the caller transaction, at version 1; starting a run that exists changes nothing. */
    async begin(params: BeginSagaParams): Promise<void> {
        await params.manager.query(BEGIN_SAGA, [params.saga, params.correlationId, this.clock.now()])
    }

    /**
     * Compensates the run after the event that reports the failure: once per run (a crash after the claim resumes it), and only
     * while the run has not settled. A failing compensation gives the event back, so its redelivery resumes the run.
     */
    async compensate(params: CompensateSagaParams): Promise<SagaTransition> {
        if (!(await this.inbox.claim(sourceOf(params.saga), params.eventId))) return "duplicate"
        const state = await this.state(params)
        if (state === null || (state.status !== "running" && state.status !== "compensating")) return "ignored"
        const claimed = state.status === "running" ? await this.move(params, state, "compensating") : state
        if (claimed === null) return "ignored"
        try {
            await params.compensate()
        } catch (error) {
            await this.inbox.release(sourceOf(params.saga), params.eventId)
            throw error
        }
        await this.move(params, claimed, "compensated")
        return "applied"
    }

    /** Settles the run as completed after the event that reports its last step done; a settled run is left as it is. */
    async complete(params: CompleteSagaParams): Promise<SagaTransition> {
        if (!(await this.inbox.claim(sourceOf(params.saga), params.eventId))) return "duplicate"
        const state = await this.state(params)
        if (state === null || state.status !== "running") return "ignored"
        return (await this.move(params, state, "completed")) === null ? "ignored" : "applied"
    }

    /** Where the run stands, or null when it does not exist. */
    async state(run: SagaRun): Promise<SagaState | null> {
        const rows: Array<SagaStateRow> = await this.entityManager.query(READ_SAGA, [run.saga, run.correlationId])
        const [row] = rows
        return row === undefined ? null : { status: row.status, version: row.version }
    }

    /** Moves the run from the state it was read in to `to`; answers the new state, or null when another transition moved it first. */
    private async move(run: SagaRun, from: SagaState, to: SagaStatus): Promise<SagaState | null> {
        const rows: Array<SagaVersionRow> = await this.entityManager.query(MOVE_SAGA, [
            run.saga,
            run.correlationId,
            from.status,
            from.version,
            to,
            this.clock.now(),
        ])
        const [row] = rows
        return row === undefined ? null : { status: to, version: row.version }
    }
}

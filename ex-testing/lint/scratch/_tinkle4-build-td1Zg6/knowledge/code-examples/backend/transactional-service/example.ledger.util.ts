import type {
    EntityManager,
} from "typeorm"

/** Params for {@link writeExampleLedger}. */
export interface WriteExampleLedgerParams {
    /** Transaction manager — the ledger row is written in the SAME tx as its source effect. */
    entityManager: EntityManager
    /** User who receives the synthetic credit. */
    userId: string
    /** Amount credited. */
    points: number
    /** Stable id of the originating grant (unique with the ledger source). */
    refId: string
}

/**
 * Append one synthetic ledger event using the caller-supplied manager.
 * Helpers never open their own connection or read this.entityManager from a service.
 *
 * @param params - See {@link WriteExampleLedgerParams}.
 */
export const writeExampleLedger = async (
    {
        entityManager,
        userId,
        points,
        refId,
    }: WriteExampleLedgerParams,
): Promise<void> => {
    await entityManager.save({
        userId,
        points,
        refId,
    } as never)
}

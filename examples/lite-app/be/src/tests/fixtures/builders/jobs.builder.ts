import type { FakeIds } from "@starci/jest-preset"
import type { EntityManager } from "typeorm"
import { READ_JOB } from "@modules/platform/jobs"
import type { JobSnapshotRow } from "@modules/platform/jobs"

/** Unique delivery keys and persisted progress in the world's rollback transaction. */
export const createJobsBuilder = (manager: () => EntityManager, ids: Pick<FakeIds, "next">) => {
    const prefix = `lite-fenced-proof-${ids.next()}-`
    return {
        get manager(): EntityManager {
            return manager()
        },
        key(scenario: string): string {
            return `${prefix}${scenario}`
        },
        async snapshot(key: string): Promise<JobSnapshotRow | undefined> {
            const rows = await manager().query<Array<JobSnapshotRow>>(READ_JOB, [key])
            return rows[0]
        },
    }
}

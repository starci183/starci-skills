import { JobEntity } from "./entities/job.entity"
import { CreateJobs1789800011000 } from "./migrations/1789800011000-create-jobs"

/** The entities of the jobs, for every connection that runs jobs. */
export const jobsEntities = [JobEntity]

/** The migrations of the jobs, in the order they run. */
export const jobsMigrations = [CreateJobs1789800011000]

import { JobEntity } from "./entities/job.entity"
import { CreateJobs@@epochMs13@@ } from "./migrations/@@epochMs13@@-create-jobs"

/** The entities of the jobs, for every connection that runs jobs. */
export const jobsEntities = [JobEntity]

/** The migrations of the jobs, in the order they run. */
export const jobsMigrations = [CreateJobs@@epochMs13@@]

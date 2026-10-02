/** How many deliveries BullMQ gives a job before it keeps it as failed. */
export const ATTEMPTS = 5

/** The pause after the first failed delivery; BullMQ doubles it with every further failure. */
export const BACKOFF_MS = 1000

/** How long BullMQ keeps a completed job (seconds): long enough that a repeated relay pass finds its job id and adds nothing. */
export const KEEP_COMPLETED_SECONDS = 3600

/** The name the jobs of every queue carry inside their queue. */
export const jobNameOf = (queue: string): string => queue

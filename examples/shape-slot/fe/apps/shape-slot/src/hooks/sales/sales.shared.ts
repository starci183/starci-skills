import { z } from "zod"

/** The key prefix of every order read, so a mutation can revalidate them all at once. */
export const QUERY_ORDER_SWR_KEY = "QUERY_ORDER_SWR"

/** The key prefix of every handoff read. */
export const QUERY_HANDOFF_SWR_KEY = "QUERY_HANDOFF_SWR"

/** The key prefix of every send-attempts read. */
export const QUERY_SEND_ATTEMPTS_SWR_KEY = "QUERY_SEND_ATTEMPTS_SWR"

const revisionErrorMessage = "sales.send.errors.revisionMin"

/**
 * The send form, validated at the edge. Error messages are message KEYS, never prose:
 * the connected half resolves them with next-intl before they reach the pure half.
 */
export const sendHandoffSchema = z.object({
    fingerprint: z.string().trim().min(1, "sales.send.errors.fingerprintRequired"),
    revision: z.number(revisionErrorMessage).int(revisionErrorMessage).min(1, revisionErrorMessage),
    note: z.string().max(500, "sales.send.errors.noteTooLong"),
})

/** Values of the send form, inferred from the schema so the two never drift. */
export type SendHandoffFormValues = z.infer<typeof sendHandoffSchema>

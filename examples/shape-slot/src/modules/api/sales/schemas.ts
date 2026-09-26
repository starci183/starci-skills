import { z } from "zod"

/**
 * The send form, validated at the edge. Error messages are message KEYS, never prose:
 * the connected half resolves them with next-intl before they reach the pure half.
 */
export const sendHandoffSchema = z.object({
    fingerprint: z.string().trim().min(1, "sales.send.errors.fingerprintRequired"),
    revision: z.number().int().min(1, "sales.send.errors.revisionMin"),
    note: z.string().max(500, "sales.send.errors.noteTooLong"),
})

/** Values of the send form, inferred from the schema so the two never drift. */
export type SendHandoffFormValues = z.infer<typeof sendHandoffSchema>

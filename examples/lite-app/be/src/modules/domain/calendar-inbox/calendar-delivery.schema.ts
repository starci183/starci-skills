import { z } from "zod"

/** The delivery a receipt retains, as it is read back from the inbox row: the one identity the intake needs, bounded as the webhook door bounds it. */
export const CalendarDeliverySchema = z.object({
    id: z.string().max(64),
})

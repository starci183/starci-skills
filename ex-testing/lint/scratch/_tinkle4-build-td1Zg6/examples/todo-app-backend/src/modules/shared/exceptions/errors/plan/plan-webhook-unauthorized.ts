import {
    AbstractException 
} from "../abstract"
import type {
    AbstractExceptionMetadata 
} from "../abstract"

/** Type alias naming the plan webhook unauthorized exception metadata set plan-webhook-unauthorized switches on; a new member is added here once, not scattered as literals. */
export type PlanWebhookUnauthorizedExceptionMetadata = AbstractExceptionMetadata;

/**
 * fr.plan.upgrade's exception flow: "The webhook arrives with an invalid signature; it is ignored, the
 * subscription stays pending, and no money is treated as received." SePay's own webhook delivery is
 * authenticated by a shared secret carried in the request's Authorization header (integration.plan.sepay
 * credential), not a computed body signature; this exception names a header that fails that comparison.
 * The webhook controller catches this and answers the gateway without applying anything, exactly as an
 * ignored delivery should.
 */
export class PlanWebhookUnauthorizedException extends AbstractException {
    constructor(metadata: PlanWebhookUnauthorizedExceptionMetadata = {
    }) {
        super("The webhook could not be authenticated.",
            "PLAN_WEBHOOK_UNAUTHORIZED_EXCEPTION",
            metadata)
    }
}

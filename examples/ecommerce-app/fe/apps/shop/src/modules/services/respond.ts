import "server-only"
import { NextResponse } from "next/server"
import type { Outcome } from "@ecommerce/api"

/** The JSON body of a request to one of the shop's own doors; a body that is not JSON reads as `null`. */
export const readBody = async (request: Request): Promise<unknown> => {
    try {
        return (await request.json()) as unknown
    } catch {
        return null
    }
}

/**
 * An Outcome as the shop's own door answers it: the payload with 200, and a failure with the status the
 * client maps back to the same kind - `refused` 401, `invalid` 422 (409 for a taken email) with its code and
 * details, `not-found` 404, `unavailable` 502. The body never carries a server sentence, only the stable code.
 */
export const respond = (outcome: Outcome<unknown>): NextResponse => {
    if (outcome.kind === "ok") return NextResponse.json(outcome.data)
    if (outcome.kind === "refused")
        return NextResponse.json({ code: outcome.code ?? "SESSION_INVALID" }, { status: 401 })
    if (outcome.kind === "invalid") {
        return NextResponse.json(
            { code: outcome.code ?? "REQUEST_INVALID", details: outcome.details },
            { status: outcome.code === "EMAIL_TAKEN" ? 409 : 422 },
        )
    }
    if (outcome.kind === "not-found") return NextResponse.json({ code: "NOT_FOUND" }, { status: 404 })
    return NextResponse.json({ code: "UNAVAILABLE" }, { status: 502 })
}

import { HttpSecurityModule, ReadinessService } from "@modules/platform/http-security"
import { httpSecurityOf } from "../../world/test-apps.options"
import { useTestWorld } from "../../world/use-test-world"

/**
 * readiness: the required-dependency probe over the real primary database of the run, no HTTP door of ours. It answers ready
 * while the database commits a transaction, refuses while the database is cut and answers ready again once it is back.
 */
describe("readiness: the required database (integration)", () => {
    const world = useTestWorld({
        modules: [(w) => HttpSecurityModule.register(httpSecurityOf(w))],
    })

    const readiness = (): ReadinessService => world.resolve(ReadinessService)

    it("reports ready while the real primary database commits a transaction", async () => {
        await expect(readiness().probeRequired()).resolves.toEqual({ ok: true })
    })

    it("refuses readiness while the database is cut, then reports ready again", async () => {
        await world.interruptDatabase(async () => {
            await expect(readiness().probeRequired()).rejects.toMatchObject({
                code: "HTTP_SECURITY_REQUIRED_DEPENDENCY_UNAVAILABLE",
            })
        })
        await expect(readiness().probeRequired()).resolves.toEqual({ ok: true })
    })
})

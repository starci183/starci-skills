import { Credential } from "@modules/domain/identity"
import { RequestMethod } from "@nestjs/common"
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants"
import type { LivenessReport } from "@modules/domain/liveness"
import { StatusController } from "@features/api/tool-status"
import { buildToolStatusProof } from "@tests/fixtures/builders/api.builder"
import { useTestWorld } from "@tests/world/test-world.kit"

describe("StatusController", () => {
    const world = useTestWorld({
        modules: buildToolStatusProof,
    })

    it("dispatches the tool id once and returns the typed status report", async () => {
        const { queryBus, controller, query } = world.modules
        const report: LivenessReport = {
            status: "ok",
            startedAt: "2026-10-01T00:00:00.000Z",
            uptimeSeconds: 90,
        }
        queryBus.execute.mockResolvedValue(report)
        await expect(controller.status("tool-1")).resolves.toEqual(report)

        expect(queryBus.execute).toHaveBeenCalledTimes(1)
        expect(queryBus.execute).toHaveBeenCalledWith(query("tool-1"))
    })

    it("marks GET /tools/status/:id as a tool-token credential door", () => {
        const handler = StatusController.prototype.status
        const credential = Credential({ kind: "tool-token" })

        expect(Reflect.getMetadata(PATH_METADATA, StatusController)).toBe("tools")
        expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe("status/:id")
        expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(RequestMethod.GET)
        expect(Reflect.getMetadata(credential.KEY, handler)).toEqual({ kind: "tool-token" })
    })

    it("leaves admission to the global guards without public or local guard metadata", () => {
        for (const target of [StatusController, StatusController.prototype.status]) {
            expect(Reflect.getMetadata("domain.identity.public", target)).toBeUndefined()
            expect(Reflect.getMetadata(GUARDS_METADATA, target)).toBeUndefined()
        }
    })
})

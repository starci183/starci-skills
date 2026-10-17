import { Credential } from "@modules/domain/identity"
import { RequestMethod } from "@nestjs/common"
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants"
import { QueryBus } from "@nestjs/cqrs"
import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { LivenessReport } from "@modules/domain/liveness"
import { GetToolStatusQuery } from "../../application/get-tool-status.query"
import { StatusController } from "./status.controller"

describe("StatusController", () => {
    it("dispatches the tool id once and returns the typed status report", async () => {
        const queryBus = mock<QueryBus>()
        const report: LivenessReport = {
            status: "ok",
            startedAt: "2026-10-01T00:00:00.000Z",
            uptimeSeconds: 90,
        }
        queryBus.execute.mockResolvedValue(report)
        const moduleRef = await Test.createTestingModule({
            providers: [StatusController, { provide: QueryBus, useValue: queryBus }],
        }).compile()

        await expect(moduleRef.get(StatusController).status("tool-1")).resolves.toEqual(report)

        expect(queryBus.execute).toHaveBeenCalledTimes(1)
        expect(queryBus.execute).toHaveBeenCalledWith(new GetToolStatusQuery({ request: { id: "tool-1" } }))
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

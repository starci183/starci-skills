import type { QueryBus } from "@nestjs/cqrs"
import { mock } from "@starci/jest-preset/mock"
import { ProbesError, ProbesErrorCode } from "@modules/platform/probes"
import { CheckHealthQuery } from "../../application/check-health.query"
import { HealthController } from "./health.controller"

describe("HealthController", () => {
    it("dispatches the health query and answers ok with the report of a healthy service", async () => {
        const queryBus = mock<QueryBus>({
            execute: jest
                .fn()
                .mockResolvedValue({
                    kind: "ok",
                    value: { service: "demo", checks: { database: "ok" }, healthy: true },
                }),
        })
        await expect(new HealthController(queryBus).checkHealth()).resolves.toEqual({
            status: "ok",
            service: "demo",
            checks: { database: "ok" },
        })
        expect(queryBus.execute).toHaveBeenCalledWith(expect.any(CheckHealthQuery))
    })

    it("turns the refusal into the probes error, carrying the state of each dependency", async () => {
        const queryBus = mock<QueryBus>({
            execute: jest.fn().mockResolvedValue({
                kind: "refused",
                code: ProbesErrorCode.DependencyUnavailable,
                params: { database: "unreachable" },
            }),
        })
        const call = new HealthController(queryBus).checkHealth()
        await expect(call).rejects.toBeInstanceOf(ProbesError)
        await expect(call).rejects.toMatchObject({ params: { database: "unreachable" } })
    })
})

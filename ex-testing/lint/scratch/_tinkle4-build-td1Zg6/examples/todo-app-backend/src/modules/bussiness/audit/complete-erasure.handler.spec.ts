import {
    Test, TestingModule 
} from "@nestjs/testing"
import {
    getEntityManagerToken 
} from "@nestjs/typeorm"
import {
    POSTGRESQL_PRIMARY 
} from "@modules/platform/databases/postgresql/primary/constants/connection"
import {
    createFakeAuditEntityManager 
} from "./testing/fake-audit-entity-manager"
import {
    AuditKeystoreService 
} from "./audit-keystore.service"
import {
    AuditLogService 
} from "./audit-log.service"
import {
    AuditErasureService 
} from "./audit-erasure.service"
import {
    RequestErasureHandler 
} from "./request-erasure.handler"
import {
    RequestErasureCommand 
} from "./request-erasure.command"
import {
    CompleteErasureCommand 
} from "./complete-erasure.command"
import {
    CompleteErasureHandler 
} from "./complete-erasure.handler"

describe("CompleteErasureHandler",
    () => {
        let moduleRef: TestingModule
        let log: AuditLogService
        let requestHandler: RequestErasureHandler
        let completeHandler: CompleteErasureHandler

        beforeEach(async () => {
            moduleRef = await Test.createTestingModule({
                providers: [
                    CompleteErasureHandler,
                    RequestErasureHandler,
                    AuditKeystoreService,
                    AuditLogService,
                    AuditErasureService,
                    {
                        provide: getEntityManagerToken(POSTGRESQL_PRIMARY), useValue: createFakeAuditEntityManager() 
                    },
                ],
            }).compile()
            log = moduleRef.get(AuditLogService)
            requestHandler = moduleRef.get(RequestErasureHandler)
            completeHandler = moduleRef.get(CompleteErasureHandler)
        })

        afterEach(async () => {
            await moduleRef.close()
        })

        it("fr.audit.erasure.complete: moves the request to complete, and export subsequently returns nothing for the subject",
            async () => {
                await log.append("person-1",
                    "task.created",
                    "task-1")

                const requested = await requestHandler.execute(new RequestErasureCommand({
                    personId: "person-1" 
                }))
                const result = await completeHandler.execute(new CompleteErasureCommand({
                    requestId: requested.requestId, callerId: "person-1" 
                }))

                expect(result.state).toBe("complete")
                expect(await log.exportForPerson("person-1")).toEqual([])
            })

        it("refuses when the caller is not the request's own subject",
            async () => {
                const requested = await requestHandler.execute(new RequestErasureCommand({
                    personId: "person-1" 
                }))

                await expect(
                    completeHandler.execute(new CompleteErasureCommand({
                        requestId: requested.requestId, callerId: "person-2" 
                    })),
                ).rejects.toMatchObject({
                    code: "ERASURE_REQUEST_FORBIDDEN_EXCEPTION" 
                })
            })
    })

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
    ExportMyDataQuery 
} from "./export-my-data.query"
import {
    ExportMyDataHandler 
} from "./export-my-data.handler"

describe("ExportMyDataHandler",
    () => {
        let moduleRef: TestingModule
        let log: AuditLogService
        let erasureService: AuditErasureService
        let handler: ExportMyDataHandler

        beforeEach(async () => {
            moduleRef = await Test.createTestingModule({
                providers: [
                    ExportMyDataHandler,
                    AuditKeystoreService,
                    AuditLogService,
                    AuditErasureService,
                    {
                        provide: getEntityManagerToken(POSTGRESQL_PRIMARY), useValue: createFakeAuditEntityManager() 
                    },
                ],
            }).compile()
            log = moduleRef.get(AuditLogService)
            erasureService = moduleRef.get(AuditErasureService)
            handler = moduleRef.get(ExportMyDataHandler)
        })

        afterEach(async () => {
            await moduleRef.close()
        })

        it("fr.audit.export: the export contains no other person's lines",
            async () => {
                await log.append("person-1",
                    "task.created",
                    "task-1")
                await log.append("person-2",
                    "task.created",
                    "task-2")

                const result = await handler.execute(new ExportMyDataQuery({
                    personId: "person-1" 
                }))

                expect(result.lines).toHaveLength(1)
                expect(result.lines[0].target).toBe("task-1")
            })

        it("exceptionFlow: once the person's key has been destroyed by a completed erasure, export returns nothing",
            async () => {
                await log.append("person-1",
                    "task.created",
                    "task-1")
                const requested = await erasureService.request("person-1")
                await erasureService.execute(requested.requestId,
                    "person-1")

                const result = await handler.execute(new ExportMyDataQuery({
                    personId: "person-1" 
                }))

                expect(result.lines).toEqual([])
            })
    })

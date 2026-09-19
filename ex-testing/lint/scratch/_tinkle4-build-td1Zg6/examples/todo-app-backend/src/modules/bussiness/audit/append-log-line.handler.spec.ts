import {
    Test 
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
    AppendLogLineCommand 
} from "./append-log-line.command"
import {
    AppendLogLineHandler 
} from "./append-log-line.handler"

describe("AppendLogLineHandler",
    () => {
        it("fr.audit.log.append: appends a line and reports the count increasing by exactly one",
            async () => {
                const moduleRef = await Test.createTestingModule({
                    providers: [
                        AppendLogLineHandler,
                        AuditKeystoreService,
                        AuditLogService,
                        {
                            provide: getEntityManagerToken(POSTGRESQL_PRIMARY), useValue: createFakeAuditEntityManager() 
                        },
                    ],
                }).compile()
                try {
                    const log = moduleRef.get(AuditLogService)
                    const handler = moduleRef.get(AppendLogLineHandler)

                    const before = await log.verifyChain()
                    const result = await handler.execute(new AppendLogLineCommand({
                        actorId: "person-1", action: "sign-in", target: null 
                    }))
                    const after = await log.verifyChain()

                    expect(after.totalLines).toBe(before.totalLines + 1)
                    expect(after.valid).toBe(true)
                    expect(result.lineId).toEqual(expect.any(String))
                } finally {
                    await moduleRef.close()
                }
            })
    })

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
    AuditErasureService 
} from "./audit-erasure.service"
import {
    RequestErasureCommand 
} from "./request-erasure.command"
import {
    RequestErasureHandler 
} from "./request-erasure.handler"

describe("RequestErasureHandler",
    () => {
        it("fr.audit.erasure.request: exactly one erasure-request row exists per submission, in state requested (then verified, since the caller is the subject)",
            async () => {
                const moduleRef = await Test.createTestingModule({
                    providers: [
                        RequestErasureHandler,
                        AuditKeystoreService,
                        AuditLogService,
                        AuditErasureService,
                        {
                            provide: getEntityManagerToken(POSTGRESQL_PRIMARY), useValue: createFakeAuditEntityManager() 
                        },
                    ],
                }).compile()
                try {
                    const handler = moduleRef.get(RequestErasureHandler)

                    const result = await handler.execute(new RequestErasureCommand({
                        personId: "person-1" 
                    }))

                    expect(result.requestId).toEqual(expect.any(String))
                    expect(result.state).toBe("verified")
                } finally {
                    await moduleRef.close()
                }
            })
    })

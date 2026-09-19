import {
    Test, TestingModule 
} from "@nestjs/testing"
import {
    QueryRunner 
} from "typeorm"
import {
    CreateIdentityTables1789800000000 
} from "./1789800000000-create-identity-tables"

describe("CreateIdentityTables1789800000000 - the identity schema bootstrap",
    () => {
        let moduleRef: TestingModule
        let migration: CreateIdentityTables1789800000000
        let query: jest.Mock
        let runner: QueryRunner

        beforeEach(async () => {
            query = jest.fn().mockResolvedValue(undefined)
            runner = {
                query 
            } as unknown as QueryRunner
            moduleRef = await Test.createTestingModule({
                providers: [CreateIdentityTables1789800000000],
            }).compile()
            migration = moduleRef.get(CreateIdentityTables1789800000000)
        })

        afterEach(() => moduleRef.close())

        it("names itself after its timestamp for the migration ledger",
            () => {
                expect(migration.name).toBe("CreateIdentityTables1789800000000")
            })

        it("up creates identity_person idempotently then seeds the demo person only when absent",
            async () => {
                await migration.up(runner)

                expect(query).toHaveBeenCalledTimes(2)
                expect(query.mock.calls[0][0]).toContain("CREATE TABLE IF NOT EXISTS identity_person")
                expect(query.mock.calls[1][0]).toContain("demo@ecommerce.dev")
                expect(query.mock.calls[1][0]).toContain("WHERE NOT EXISTS")
            })

        it("down drops the identity table idempotently",
            async () => {
                await migration.down(runner)

                expect(query).toHaveBeenCalledTimes(1)
                expect(query).toHaveBeenCalledWith("DROP TABLE IF EXISTS identity_person")
            })
    })

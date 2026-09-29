import {
    Test, TestingModule 
} from "@nestjs/testing"
import {
    getDataSourceToken 
} from "@nestjs/typeorm"
import {
    CONNECTION 
} from "./persistence"
import {
    PostgresPrimaryClient 
} from "./primary.client"

describe("PostgresPrimaryClient (identity) - the named-connection liveness probe",
    () => {
        const boot = async (query: jest.Mock) => {
            const moduleRef: TestingModule = await Test.createTestingModule({
                providers: [
                    PostgresPrimaryClient,
                    {
                        provide: getDataSourceToken(CONNECTION), useValue: {
                            query 
                        } 
                    },
                ],
            }).compile()
            return {
                moduleRef, client: moduleRef.get(PostgresPrimaryClient) 
            }
        }

        it("issues select 1 on the CONNECTION data source",
            async () => {
                const query = jest.fn().mockResolvedValue([{
                    "?column?": 1 
                }])
                const { moduleRef, client } = await boot(query)
                try {
                    await expect(client.ping()).resolves.toBeUndefined()
                    expect(query).toHaveBeenCalledTimes(1)
                    expect(query).toHaveBeenCalledWith("select 1")
                } finally {
                    await moduleRef.close()
                }
            })

        it("surfaces a dead database honestly instead of swallowing the error",
            async () => {
                const query = jest.fn().mockRejectedValue(new Error("connection refused"))
                const { moduleRef, client } = await boot(query)
                try {
                    await expect(client.ping()).rejects.toThrow("connection refused")
                } finally {
                    await moduleRef.close()
                }
            })
    })

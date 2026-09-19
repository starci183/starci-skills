import {
    Test, TestingModule 
} from "@nestjs/testing"
import {
    AppConfigService 
} from "@modules/platform/config/app-config.service"
import {
    SepayClient 
} from "./sepay.client"

/** Edge cases for sepay.client.ts beyond the main spec's coverage: exact-match webhook comparison,
 * JSON answers that parse but are not objects, and the shape edges of getTransaction's reply. */

function gatewayResponse(status: number, body: string): Response {
    return {
        ok: status >= 200 && status < 300, status, text: async () => body 
    } as unknown as Response
}

const modules: Array<TestingModule> = []

async function clientWith(config: Partial<AppConfigService>): Promise<SepayClient> {
    const moduleRef = await Test.createTestingModule({
        providers: [SepayClient,
            {
                provide: AppConfigService, useValue: config 
            }],
    }).compile()
    modules.push(moduleRef)
    return moduleRef.get(SepayClient)
}

function gatewayClient(): Promise<SepayClient> {
    return clientWith({
        getSepayBaseUrl: () => "https://my.sepay.vn",
        getSepayApiKey: () => "a-key",
    })
}

afterEach(async () => {
    jest.restoreAllMocks()
    while (modules.length) await modules.pop()?.close()
})

describe("SepayClient.assertWebhookAuthorized edge cases",
    () => {
        it("refuses an absent header even when a secret is configured",
            async () => {
                const client = await clientWith({
                    getSepayWebhookSecret: () => "the-real-secret" 
                })
                expect(() => client.assertWebhookAuthorized(undefined)).toThrow(
                    expect.objectContaining({
                        code: "PLAN_WEBHOOK_UNAUTHORIZED_EXCEPTION" 
                    }),
                )
            })

        it("compares the whole Bearer header: wrong scheme, wrong case or padding all fail",
            async () => {
                const client = await clientWith({
                    getSepayWebhookSecret: () => "the-real-secret" 
                })
                for (const header of [
                    "the-real-secret",
                    "bearer the-real-secret",
                    "Bearer the-real-secret ",
                    "Bearer the-real-secret-extra",
                    "Bearer",
                    "",
                ]) {
                    expect(() => client.assertWebhookAuthorized(header)).toThrow(
                        expect.objectContaining({
                            code: "PLAN_WEBHOOK_UNAUTHORIZED_EXCEPTION" 
                        }),
                    )
                }
            })
    })

describe("SepayClient.createIntent edge cases",
    () => {
        it("refuses a JSON answer that parses but is not an object",
            async () => {
                // 'null' is valid JSON: the failure is "not an object", reported with the body's own preview.
                jest.spyOn(global,
                    "fetch").mockResolvedValue(gatewayResponse(200,
                    "null"))
                await expect((await gatewayClient()).createIntent({
                    subscriptionId: "sub-1", amount: 99000, currency: "VND" 
                }))
                    .rejects.toThrow(/null \(HTTP 200/)
            })

        it("refuses a transaction id that is present but empty",
            async () => {
                jest
                    .spyOn(global,
                        "fetch")
                    .mockResolvedValue(gatewayResponse(200,
                        JSON.stringify({
                            id: "", qrCodeUrl: "https://pay.example/qr/x" 
                        })))
                await expect((await gatewayClient()).createIntent({
                    subscriptionId: "sub-1", amount: 99000, currency: "VND" 
                }))
                    .rejects.toThrow(/no transaction id and checkout url/)
            })
    })

describe("SepayClient.getTransaction edge cases",
    () => {
        it("refuses a periodEnd that is an object rather than a date",
            async () => {
                jest
                    .spyOn(global,
                        "fetch")
                    .mockResolvedValue(gatewayResponse(200,
                        JSON.stringify({
                            status: "paid", periodEnd: {
                                iso: "2027-01-01" 
                            } 
                        })))
                await expect((await gatewayClient()).getTransaction("TN9")).rejects.toThrow(/periodEnd that is not a date/)
            })

        it("refuses a non-string status rather than coercing it into the vocabulary",
            async () => {
                jest.spyOn(global,
                    "fetch").mockResolvedValue(gatewayResponse(200,
                    JSON.stringify({
                        status: 200 
                    })))
                await expect((await gatewayClient()).getTransaction("TN9")).rejects.toThrow(/unrecognised status 200/)
            })

        it("carries the failed status through unchanged",
            async () => {
                jest.spyOn(global,
                    "fetch").mockResolvedValue(gatewayResponse(200,
                    JSON.stringify({
                        status: "failed" 
                    })))
                await expect((await gatewayClient()).getTransaction("TN9")).resolves.toEqual({
                    status: "failed", periodEnd: undefined 
                })
            })

        it("accepts an epoch-milliseconds periodEnd",
            async () => {
                const epochMs = Date.parse("2027-01-01T00:00:00.000Z")
                jest
                    .spyOn(global,
                        "fetch")
                    .mockResolvedValue(gatewayResponse(200,
                        JSON.stringify({
                            status: "paid", periodEnd: epochMs 
                        })))
                await expect((await gatewayClient()).getTransaction("TN9")).resolves.toEqual({
                    status: "paid",
                    periodEnd: new Date(epochMs),
                })
            })

        it("refuses a gateway answer that is not JSON at all",
            async () => {
                jest.spyOn(global,
                    "fetch").mockResolvedValue(gatewayResponse(502,
                    "<html>bad gateway</html>"))
                await expect((await gatewayClient()).getTransaction("TN9")).rejects.toThrow(/body that is not JSON/)
            })
    })

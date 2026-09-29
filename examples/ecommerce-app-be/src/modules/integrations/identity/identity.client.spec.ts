import {
    once 
} from "node:events"
import {
    createServer, Server, ServerResponse 
} from "node:http"
import {
    AddressInfo 
} from "node:net"
import {
    Test 
} from "@nestjs/testing"
import {
    mock 
} from "@starci/jest-preset/mock"
import {
    OrderConfigService 
} from "@modules/platform/config/index"
import {
    LogId, Logger 
} from "@modules/platform/logging/index"
import {
    IdentityApiClient 
} from "./identity.client"

const answer = (res: ServerResponse, status: number, body: string): void => {
    res.writeHead(status,
        {
            "content-type": "application/json" 
        })
    res.end(body)
}

/** What the fake identity service answers for each session token the specs present; any other token is a refusal. */
const VERIFY_ANSWERS = new Map<string, (res: ServerResponse) => void>([
    ["live-token",
        (res) => answer(res,
            200,
            JSON.stringify({
                personId: "person-1" 
            }))],
    ["off-contract-token",
        (res) => answer(res,
            200,
            JSON.stringify({
                sub: "person-1" 
            }))],
    ["empty-person-token",
        (res) => answer(res,
            200,
            JSON.stringify({
                personId: "" 
            }))],
    ["numeric-person-token",
        (res) => answer(res,
            200,
            JSON.stringify({
                personId: 42 
            }))],
    ["garbage-body-token",
        (res) => answer(res,
            200,
            "this is not json")],
    ["broken-token",
        (res) => answer(res,
            500,
            JSON.stringify({
                code: "INTERNAL" 
            }))],
    // never answers - the client's own abort deadline is the edge under test
    ["hanging-token",
        () => undefined],
])

const refuse = (res: ServerResponse): void => answer(res,
    401,
    JSON.stringify({
        code: "SESSION_INVALID_EXCEPTION" 
    }))

/**
 * sds.checkout.order-flow's sequence step "order -> identity: verify the bearer session" against
 * a real HTTP server on a real loopback socket, on a base URL that arrives exactly the way
 * production's does (OrderConfigService.getIdentityApiBaseUrl() from metadata.json or its override).
 */
describe("IdentityApiClient - order calls identity over real HTTP",
    () => {
        let server: Server
        let baseUrl: string
        let client: IdentityApiClient
        let healthAnswersOk = true
        const config = mock<OrderConfigService>({
            getIdentityApiBaseUrl: () => baseUrl 
        })
        const logger = mock<Logger>()

        beforeAll(async () => {
            server = createServer((req, res) => {
                if (req.method === "POST" && req.url === "/internal/sessions/verify") {
                    let raw = ""
                    req.on("data",
                        (chunk: Buffer) => {
                            raw += chunk
                        })
                    req.on("end",
                        () => {
                            const { sessionToken } = JSON.parse(raw) as { sessionToken?: string }
                            const respond = VERIFY_ANSWERS.get(sessionToken ?? "") ?? refuse
                            respond(res)
                        })
                    return
                }
                if (req.method === "GET" && req.url === "/health") {
                    answer(res,
                        healthAnswersOk ? 200 : 503,
                        JSON.stringify({
                            status: healthAnswersOk ? "ok" : "unavailable" 
                        }))
                    return
                }
                res.writeHead(404).end()
            })
            server.listen(0,
                "127.0.0.1")
            await once(server,
                "listening")
            baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
        })

        afterAll(async () => {
            server.close()
            await once(server,
                "close")
        })

        beforeEach(async () => {
            jest.clearAllMocks()
            const moduleRef = await Test.createTestingModule({
                providers: [
                    IdentityApiClient,
                    {
                        provide: OrderConfigService, useValue: config 
                    },
                    {
                        provide: Logger, useValue: logger 
                    },
                ],
            }).compile()
            client = moduleRef.get(IdentityApiClient)
        })

        it("sds.checkout.order-flow verify-session: a live token answers with its person over real HTTP",
            async () => {
                expect(await client.verifySession("live-token")).toEqual({
                    personId: "person-1" 
                })
            })

        it("sds.checkout.order-flow verify-session: a refused token is null for the consumer to turn into its own refusal",
            async () => {
                expect(await client.verifySession("stale-token")).toBeNull()
            })

        it("sds.checkout.order-flow verify-session: an unreachable identity is a typed unavailable error, never a pass-through",
            async () => {
                const reachable = baseUrl
                baseUrl = "http://127.0.0.1:1"
                try {
                    await expect(client.verifySession("live-token")).rejects.toMatchObject({
                        code: "IDENTITY_SERVICE_UNAVAILABLE_EXCEPTION" 
                    })
                } finally {
                    baseUrl = reachable
                }
            })

        it("a non-401 failure from identity is a typed unavailable error, not the provider's status passed through",
            async () => {
                await expect(client.verifySession("broken-token")).rejects.toMatchObject({
                    code: "IDENTITY_SERVICE_UNAVAILABLE_EXCEPTION" 
                })
            })

        it("a 200 answering outside the session contract is IDENTITY_CONTRACT_MISMATCH, never a phantom person",
            async () => {
                await expect(client.verifySession("off-contract-token")).rejects.toMatchObject({
                    code: "IDENTITY_CONTRACT_MISMATCH_EXCEPTION" 
                })
            })

        it.each([["empty-person-token"],
            ["numeric-person-token"]])(
            "a 200 whose personId is unusable (%s) is IDENTITY_CONTRACT_MISMATCH, never an invented actor",
            async (token) => {
                await expect(client.verifySession(token)).rejects.toMatchObject({
                    code: "IDENTITY_CONTRACT_MISMATCH_EXCEPTION" 
                })
            },
        )

        it("a 200 with an unreadable body is IDENTITY_CONTRACT_MISMATCH, not a raw parse failure",
            async () => {
                await expect(client.verifySession("garbage-body-token")).rejects.toMatchObject({
                    code: "IDENTITY_CONTRACT_MISMATCH_EXCEPTION" 
                })
            })

        it("an identity that never answers inside the client deadline is a typed unavailable error, not an infinite wait",
            async () => {
                await expect(client.verifySession("hanging-token")).rejects.toMatchObject({
                    code: "IDENTITY_SERVICE_UNAVAILABLE_EXCEPTION" 
                })
            },
            10000)

        it("a reachable identity answering a non-ok /health reports not healthy",
            async () => {
                healthAnswersOk = false
                try {
                    expect(await client.isHealthy()).toBe(false)
                } finally {
                    healthAnswersOk = true
                }
            })

        it("order health answers identity-unreachable, and logs the probe failure, when the provider is down",
            async () => {
                expect(await client.isHealthy()).toBe(true)
                expect(logger.warn).not.toHaveBeenCalled()
                const reachable = baseUrl
                baseUrl = "http://127.0.0.1:1"
                try {
                    expect(await client.isHealthy()).toBe(false)
                    expect(logger.warn).toHaveBeenCalledWith(LogId.DependencyProbeFailed,
                        expect.objectContaining({
                            dependency: "identity" 
                        }))
                } finally {
                    baseUrl = reachable
                }
            })
    })

import {
    createServer, Server 
} from "node:http"
import {
    AddressInfo 
} from "node:net"
import {
    once 
} from "node:events"
import {
    HttpException 
} from "@nestjs/common"
import {
    Test 
} from "@nestjs/testing"
import {
    AppConfigService 
} from "@modules/platform/config/order/app-config.service"
import {
    IdentityApiClient 
} from "./identity.client"

/**
 * sds.checkout.order-flow's sequence step "order -> identity: verify the bearer session" against
 * a real HTTP server on a real loopback socket, on a base URL that arrives exactly the way
 * production's does (AppConfigService.getIdentityApiBaseUrl() from metadata.json or its override).
 */
describe("IdentityApiClient - order calls identity over real HTTP",
    () => {
        let server: Server
        let baseUrl: string
        let client: IdentityApiClient
        let healthAnswersOk = true
        const config = {
            getIdentityApiBaseUrl: () => baseUrl 
        }

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
                            if (sessionToken === "live-token") {
                                res.writeHead(200,
                                    {
                                        "content-type": "application/json" 
                                    })
                                res.end(JSON.stringify({
                                    personId: "person-1" 
                                }))
                            } else if (sessionToken === "off-contract-token") {
                                res.writeHead(200,
                                    {
                                        "content-type": "application/json" 
                                    })
                                res.end(JSON.stringify({
                                    sub: "person-1" 
                                }))
                            } else if (sessionToken === "empty-person-token") {
                                res.writeHead(200,
                                    {
                                        "content-type": "application/json" 
                                    })
                                res.end(JSON.stringify({
                                    personId: "" 
                                }))
                            } else if (sessionToken === "numeric-person-token") {
                                res.writeHead(200,
                                    {
                                        "content-type": "application/json" 
                                    })
                                res.end(JSON.stringify({
                                    personId: 42 
                                }))
                            } else if (sessionToken === "garbage-body-token") {
                                res.writeHead(200,
                                    {
                                        "content-type": "application/json" 
                                    })
                                res.end("this is not json")
                            } else if (sessionToken === "hanging-token") {
                                return // never answers - the client's own abort deadline is the edge under test
                            } else if (sessionToken === "broken-token") {
                                res.writeHead(500,
                                    {
                                        "content-type": "application/json" 
                                    })
                                res.end(JSON.stringify({
                                    code: "INTERNAL" 
                                }))
                            } else {
                                res.writeHead(401,
                                    {
                                        "content-type": "application/json" 
                                    })
                                res.end(JSON.stringify({
                                    code: "SESSION_INVALID_EXCEPTION" 
                                }))
                            }
                            return
                        })
                    return
                }
                if (req.method === "GET" && req.url === "/health") {
                    res.writeHead(healthAnswersOk ? 200 : 503,
                        {
                            "content-type": "application/json" 
                        })
                    res.end(JSON.stringify({
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
            const moduleRef = await Test.createTestingModule({
                providers: [IdentityApiClient,
                    {
                        provide: AppConfigService, useValue: config 
                    }],
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

        it("sds.checkout.order-flow verify-session: an unreachable identity is a typed 503, never a pass-through",
            async () => {
                const unreachable = baseUrl
                baseUrl = "http://127.0.0.1:1"
                try {
                    await client.verifySession("live-token")
                    throw new Error("the call should have failed")
                } catch (error) {
                    expect(error).toBeInstanceOf(HttpException)
                    expect((error as HttpException).getStatus()).toBe(503)
                    expect((error as HttpException).getResponse()).toMatchObject({
                        code: "IDENTITY_SERVICE_UNAVAILABLE_EXCEPTION" 
                    })
                } finally {
                    baseUrl = unreachable
                }
            })

        it("a non-401 failure from identity is a typed 503, not the provider's status passed through",
            async () => {
                try {
                    await client.verifySession("broken-token")
                    throw new Error("the call should have failed")
                } catch (error) {
                    expect(error).toBeInstanceOf(HttpException)
                    expect((error as HttpException).getStatus()).toBe(503)
                    expect((error as HttpException).getResponse()).toMatchObject({
                        code: "IDENTITY_SERVICE_UNAVAILABLE_EXCEPTION" 
                    })
                }
            })

        it("a 200 answering outside the session contract is IDENTITY_CONTRACT_MISMATCH, never a phantom person",
            async () => {
                try {
                    await client.verifySession("off-contract-token")
                    throw new Error("the call should have failed")
                } catch (error) {
                    expect(error).toBeInstanceOf(HttpException)
                    expect((error as HttpException).getStatus()).toBe(503)
                    expect((error as HttpException).getResponse()).toMatchObject({
                        code: "IDENTITY_CONTRACT_MISMATCH_EXCEPTION" 
                    })
                }
            })

        it.each([["empty-person-token"],
            ["numeric-person-token"]])(
            "a 200 whose personId is unusable (%s) is IDENTITY_CONTRACT_MISMATCH, never an invented actor",
            async (token) => {
                try {
                    await client.verifySession(token)
                    throw new Error("the call should have failed")
                } catch (error) {
                    expect(error).toBeInstanceOf(HttpException)
                    expect((error as HttpException).getStatus()).toBe(503)
                    expect((error as HttpException).getResponse()).toMatchObject({
                        code: "IDENTITY_CONTRACT_MISMATCH_EXCEPTION" 
                    })
                }
            },
        )

        it("a 200 with an unreadable body is IDENTITY_CONTRACT_MISMATCH, not a raw parse failure",
            async () => {
                try {
                    await client.verifySession("garbage-body-token")
                    throw new Error("the call should have failed")
                } catch (error) {
                    expect(error).toBeInstanceOf(HttpException)
                    expect((error as HttpException).getStatus()).toBe(503)
                    expect((error as HttpException).getResponse()).toMatchObject({
                        code: "IDENTITY_CONTRACT_MISMATCH_EXCEPTION" 
                    })
                }
            })

        it("an identity that never answers inside the client deadline is a typed 503, not an infinite wait",
            async () => {
                try {
                    await client.verifySession("hanging-token")
                    throw new Error("the call should have failed")
                } catch (error) {
                    expect(error).toBeInstanceOf(HttpException)
                    expect((error as HttpException).getStatus()).toBe(503)
                    expect((error as HttpException).getResponse()).toMatchObject({
                        code: "IDENTITY_SERVICE_UNAVAILABLE_EXCEPTION" 
                    })
                }
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

        it("order health answers identity-unreachable when the provider is down",
            async () => {
                expect(await client.isHealthy()).toBe(true)
                const reachable = baseUrl
                baseUrl = "http://127.0.0.1:1"
                try {
                    expect(await client.isHealthy()).toBe(false)
                } finally {
                    baseUrl = reachable
                }
            })
    })

import "reflect-metadata"
import {
    createServer, Server, IncomingMessage, ServerResponse 
} from "node:http"
import {
    AddressInfo 
} from "node:net"
import {
    once 
} from "node:events"
import {
    Test, TestingModule 
} from "@nestjs/testing"
import {
    mock 
} from "@starci/jest-preset/mock"
import {
    IdentityConfigService 
} from "@modules/platform/config/index"
import {
    OrderApiClient 
} from "./order.client"

/**
 * The consumer half of contract.checkout.order-for-identity against a real HTTP server on a real
 * loopback socket - not a mocked fetch. The base URL travels exactly the way production's does
 * (through IdentityConfigService.getOrderApiBaseUrl(), resolved from metadata.json or its env override).
 */
describe("OrderApiClient - contract.checkout.order-for-identity consumer",
    () => {
        let server: Server
        let baseUrl: string
        let client: OrderApiClient

        beforeAll(async () => {
            server = createServer((req, res) => handlerBody(req,
                res))
            server.listen(0,
                "127.0.0.1")
            await once(server,
                "listening")
            baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    OrderApiClient,
                    // Reads the variable at call time so each test can point the client at a different URL.
                    {
                        provide: IdentityConfigService, useValue: mock<IdentityConfigService>({
                            getOrderApiBaseUrl: () => baseUrl 
                        })
                    },
                ],
            }).compile()
            client = module.get(OrderApiClient)
        })

        afterAll(async () => {
            server.close()
            await once(server,
                "close")
        })

        function handlerBody(req: IncomingMessage, res: ServerResponse): void {
            void req
            if (req.url === "/internal/buyers/person-1") {
                res.writeHead(200,
                    {
                        "content-type": "application/json" 
                    })
                res.end(JSON.stringify({
                    personId: "person-1", hasOrders: true 
                }))
                return
            }
            if (req.url === "/internal/buyers/person-2") {
                res.writeHead(200,
                    {
                        "content-type": "application/json" 
                    })
                res.end(JSON.stringify({
                    personId: "person-2", hasOrders: false 
                }))
                return
            }
            if (req.url === "/internal/buyers/person-lies") {
                res.writeHead(200,
                    {
                        "content-type": "application/json" 
                    })
                res.end(JSON.stringify({
                    hasOrders: true 
                }))
                return
            }
            if (req.url === "/internal/buyers/person-broken") {
                res.writeHead(500).end()
                return
            }
            if (req.url === "/internal/buyers/person-echo") {
                res.writeHead(200,
                    {
                        "content-type": "application/json" 
                    })
                res.end(JSON.stringify({
                    personId: "somebody-else", hasOrders: true 
                }))
                return
            }
            if (req.url === "/internal/buyers/person-fuzzy") {
                res.writeHead(200,
                    {
                        "content-type": "application/json" 
                    })
                res.end(JSON.stringify({
                    personId: "person-fuzzy", hasOrders: "yes" 
                }))
                return
            }
            if (req.url === "/internal/buyers/person-garbage") {
                res.writeHead(200,
                    {
                        "content-type": "application/json" 
                    })
                res.end("this is not json")
                return
            }
            if (req.url === "/internal/buyers/person-hangs") {
                return // never answers - the client's own abort deadline is the edge under test
            }
            if (req.url === "/internal/buyers/a%2Fb") {
                res.writeHead(200,
                    {
                        "content-type": "application/json" 
                    })
                res.end(JSON.stringify({
                    personId: "a/b", hasOrders: true 
                }))
                return
            }
            res.writeHead(404).end()
        }

        it("contract.checkout.order-for-identity consumer: reads a buyer answer over real HTTP",
            async () => {
                const buyer = await client.getBuyerStatus("person-1")
                expect(buyer).toEqual({
                    personId: "person-1", hasOrders: true 
                })
                const newcomer = await client.getBuyerStatus("person-2")
                expect(newcomer.hasOrders).toBe(false)
            })

        it("contract.checkout.order-for-identity consumer: a 404 buyer is hasOrders false, echoed under the asked id",
            async () => {
                await expect(client.getBuyerStatus("person-gone")).resolves.toEqual({
                    personId: "person-gone", hasOrders: false 
                })
            })

        it("contract.checkout.order-for-identity consumer: an answer outside the surface is refused, not trusted",
            async () => {
                await expect(client.getBuyerStatus("person-lies")).rejects.toMatchObject({
                    code: "ORDER_CONTRACT_MISMATCH_EXCEPTION" 
                })
            })

        it("contract.checkout.order-for-identity consumer: a non-ok provider answer is a typed ORDER_SERVICE_UNAVAILABLE",
            async () => {
                await expect(client.getBuyerStatus("person-broken")).rejects.toMatchObject({
                    code: "ORDER_SERVICE_UNAVAILABLE_EXCEPTION", message: expect.stringContaining("500") 
                })
            })

        it("contract.checkout.order-for-identity consumer: an unreachable provider is a typed ORDER_SERVICE_UNAVAILABLE, never hasOrders false",
            async () => {
                // Port 1 on loopback: connection refused, the exact shape of the provider being down.
                baseUrl = "http://127.0.0.1:1"
                try {
                    await expect(client.getBuyerStatus("person-1")).rejects.toMatchObject({
                        code: "ORDER_SERVICE_UNAVAILABLE_EXCEPTION" 
                    })
                } finally {
                    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
                }
            })

        it("contract.checkout.order-for-identity consumer: the person id travels URL-encoded in the path",
            async () => {
                await expect(client.getBuyerStatus("a/b")).resolves.toEqual({
                    personId: "a/b", hasOrders: true 
                })
            })

        it("contract.checkout.order-for-identity consumer: a 200 answering under a different person is ORDER_CONTRACT_MISMATCH",
            async () => {
                await expect(client.getBuyerStatus("person-echo")).rejects.toMatchObject({
                    code: "ORDER_CONTRACT_MISMATCH_EXCEPTION" 
                })
            })

        it("contract.checkout.order-for-identity consumer: a 200 whose hasOrders is not a boolean is ORDER_CONTRACT_MISMATCH",
            async () => {
                await expect(client.getBuyerStatus("person-fuzzy")).rejects.toMatchObject({
                    code: "ORDER_CONTRACT_MISMATCH_EXCEPTION" 
                })
            })

        it("contract.checkout.order-for-identity consumer: a 200 with an unreadable body is ORDER_CONTRACT_MISMATCH, not a raw parse failure",
            async () => {
                await expect(client.getBuyerStatus("person-garbage")).rejects.toMatchObject({
                    code: "ORDER_CONTRACT_MISMATCH_EXCEPTION" 
                })
            })

        it("contract.checkout.order-for-identity consumer: a provider that never answers inside the client deadline is a typed ORDER_SERVICE_UNAVAILABLE error, not an infinite wait",
            async () => {
                await expect(client.getBuyerStatus("person-hangs")).rejects.toMatchObject({
                    code: "ORDER_SERVICE_UNAVAILABLE_EXCEPTION" 
                })
            },
            10000)
    })

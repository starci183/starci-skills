import {
    Test, TestingModule 
} from "@nestjs/testing"
import {
    AppConfigService 
} from "@modules/platform/config/app-config.service"
import {
    KeycloakClient 
} from "./keycloak.client"

/** A syntactically-valid JWT whose payload segment carries the given claims - readSubject only ever
 * decodes that middle segment, so header and signature stay placeholders. */
function tokenWith(payload: object): string {
    return `e30.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.sig`
}

function tokenEndpointResponse(status: number, body: unknown): Response {
    return {
        ok: status >= 200 && status < 300, status, json: async () => body 
    } as unknown as Response
}

const config = {
    getKeycloakTokenUrl: () => "http://keycloak.test/realms/todo/protocol/openid-connect/token",
    getKeycloakClientId: () => "todo-api",
}

async function boot(): Promise<{ moduleRef: TestingModule; client: KeycloakClient }> {
    const moduleRef = await Test.createTestingModule({
        providers: [KeycloakClient,
            {
                provide: AppConfigService, useValue: config 
            }],
    }).compile()
    return {
        moduleRef, client: moduleRef.get(KeycloakClient) 
    }
}

describe("KeycloakClient.signIn (integration.login.keycloak)",
    () => {
        afterEach(() => jest.restoreAllMocks())

        it("posts the direct access grant to the realm token endpoint with the configured client id",
            async () => {
                const fetchMock = jest
                    .spyOn(global,
                        "fetch")
                    .mockResolvedValue(tokenEndpointResponse(200,
                        {
                            access_token: tokenWith({
                                sub: "person-1" 
                            }) 
                        }))
                const { moduleRef, client } = await boot()
                try {
                    await expect(client.signIn("person@example.com",
                        "s3cret")).resolves.toEqual({
                        subject: "person-1" 
                    })
                    const [url,
                        init] = fetchMock.mock.calls[0]
                    expect(url).toBe("http://keycloak.test/realms/todo/protocol/openid-connect/token")
                    expect(init?.method).toBe("POST")
                    expect(init?.headers).toMatchObject({
                        "content-type": "application/x-www-form-urlencoded" 
                    })
                    const params = new URLSearchParams(String(init?.body))
                    expect(params.get("grant_type")).toBe("password")
                    expect(params.get("client_id")).toBe("todo-api")
                    expect(params.get("username")).toBe("person@example.com")
                    expect(params.get("password")).toBe("s3cret")
                } finally {
                    await moduleRef.close()
                }
            })

        it("maps any refusal of the token endpoint to the same invalid-credentials exception",
            async () => {
                // br.login.password.sign-in: an unknown email and a wrong password must be indistinguishable, and
                // Keycloak already answers both with the same invalid_grant - the client must not fork on the body.
                jest.spyOn(global,
                    "fetch").mockResolvedValue(tokenEndpointResponse(401,
                    {
                        error: "invalid_grant" 
                    }))
                const { moduleRef, client } = await boot()
                try {
                    await expect(client.signIn("person@example.com",
                        "wrong")).rejects.toThrow(
                        expect.objectContaining({
                            code: "KEYCLOAK_INVALID_CREDENTIALS_EXCEPTION" 
                        }),
                    )
                } finally {
                    await moduleRef.close()
                }
            })

        it("refuses a 200 answer that carries no access token",
            async () => {
                jest.spyOn(global,
                    "fetch").mockResolvedValue(tokenEndpointResponse(200,
                    {
                        token_type: "bearer" 
                    }))
                const { moduleRef, client } = await boot()
                try {
                    await expect(client.signIn("person@example.com",
                        "s3cret")).rejects.toThrow(
                        expect.objectContaining({
                            code: "KEYCLOAK_INVALID_CREDENTIALS_EXCEPTION" 
                        }),
                    )
                } finally {
                    await moduleRef.close()
                }
            })

        it("refuses an access token whose payload segment cannot be read",
            async () => {
                jest
                    .spyOn(global,
                        "fetch")
                    .mockResolvedValue(tokenEndpointResponse(200,
                        {
                            access_token: "no-segments" 
                        }))
                const { moduleRef, client } = await boot()
                try {
                    await expect(client.signIn("person@example.com",
                        "s3cret")).rejects.toThrow(
                        expect.objectContaining({
                            code: "KEYCLOAK_INVALID_CREDENTIALS_EXCEPTION" 
                        }),
                    )
                } finally {
                    await moduleRef.close()
                }
            })

        it("refuses an access token whose payload is not JSON",
            async () => {
                const access_token = `e30.${Buffer.from("not json").toString("base64url")}.sig`
                jest.spyOn(global,
                    "fetch").mockResolvedValue(tokenEndpointResponse(200,
                    {
                        access_token 
                    }))
                const { moduleRef, client } = await boot()
                try {
                    await expect(client.signIn("person@example.com",
                        "s3cret")).rejects.toThrow(
                        expect.objectContaining({
                            code: "KEYCLOAK_INVALID_CREDENTIALS_EXCEPTION" 
                        }),
                    )
                } finally {
                    await moduleRef.close()
                }
            })

        it("refuses an access token that carries no subject",
            async () => {
                jest
                    .spyOn(global,
                        "fetch")
                    .mockResolvedValue(tokenEndpointResponse(200,
                        {
                            access_token: tokenWith({
                                name: "x" 
                            }) 
                        }))
                const { moduleRef, client } = await boot()
                try {
                    await expect(client.signIn("person@example.com",
                        "s3cret")).rejects.toThrow(
                        expect.objectContaining({
                            code: "KEYCLOAK_INVALID_CREDENTIALS_EXCEPTION" 
                        }),
                    )
                } finally {
                    await moduleRef.close()
                }
            })

        it("reports an unreachable provider as unavailable rather than as bad credentials",
            async () => {
                jest.spyOn(global,
                    "fetch").mockRejectedValue(new Error("connect ECONNREFUSED"))
                const { moduleRef, client } = await boot()
                try {
                    await expect(client.signIn("person@example.com",
                        "s3cret")).rejects.toThrow(
                        expect.objectContaining({
                            code: "KEYCLOAK_UNAVAILABLE_EXCEPTION" 
                        }),
                    )
                } finally {
                    await moduleRef.close()
                }
            })
    })

describe("KeycloakClient.notifySignOut",
    () => {
        afterEach(() => jest.restoreAllMocks())

        it("posts the sign-out notice for the revoked session’s person",
            async () => {
                const fetchMock = jest.spyOn(global,
                    "fetch").mockResolvedValue(tokenEndpointResponse(200,
                    {
                    }))
                const { moduleRef, client } = await boot()
                try {
                    await expect(client.notifySignOut("person-1")).resolves.toBeUndefined()
                    const [url,
                        init] = fetchMock.mock.calls[0]
                    expect(url).toBe("http://keycloak.test/realms/todo/protocol/openid-connect/token")
                    expect(init?.method).toBe("POST")
                    expect(JSON.parse(String(init?.body))).toEqual({
                        action: "sign-out", personId: "person-1" 
                    })
                } finally {
                    await moduleRef.close()
                }
            })

        it("is best-effort: a provider-side error answer does not block the local revoke",
            async () => {
                jest.spyOn(global,
                    "fetch").mockResolvedValue(tokenEndpointResponse(500,
                    {
                        error: "server_error" 
                    }))
                const { moduleRef, client } = await boot()
                try {
                    await expect(client.notifySignOut("person-1")).resolves.toBeUndefined()
                } finally {
                    await moduleRef.close()
                }
            })

        it("still surfaces a transport failure as KEYCLOAK_UNAVAILABLE",
            async () => {
                jest.spyOn(global,
                    "fetch").mockRejectedValue(new Error("socket hangup"))
                const { moduleRef, client } = await boot()
                try {
                    await expect(client.notifySignOut("person-1")).rejects.toThrow(
                        expect.objectContaining({
                            code: "KEYCLOAK_UNAVAILABLE_EXCEPTION" 
                        }),
                    )
                } finally {
                    await moduleRef.close()
                }
            })
    })

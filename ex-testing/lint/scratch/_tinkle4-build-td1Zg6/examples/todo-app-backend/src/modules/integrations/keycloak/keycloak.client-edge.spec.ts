import {
    Test, TestingModule 
} from "@nestjs/testing"
import {
    AppConfigService 
} from "@modules/platform/config/app-config.service"
import {
    KeycloakClient 
} from "./keycloak.client"

/** Edge cases for keycloak.client.ts beyond the main spec's coverage: malformed bodies and the
 * boundary shapes of the access-token payload this client decodes. */

function tokenWith(payload: object): string {
    return `e30.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.sig`
}

const config = {
    getKeycloakTokenUrl: () => "http://keycloak.test/realms/todo/protocol/openid-connect/token",
    getKeycloakClientId: () => "todo-api",
}

const modules: Array<TestingModule> = []

async function boot(): Promise<KeycloakClient> {
    const moduleRef = await Test.createTestingModule({
        providers: [KeycloakClient,
            {
                provide: AppConfigService, useValue: config 
            }],
    }).compile()
    modules.push(moduleRef)
    return moduleRef.get(KeycloakClient)
}

afterEach(async () => {
    jest.restoreAllMocks()
    while (modules.length) await modules.pop()?.close()
})

describe("KeycloakClient.signIn edge cases",
    () => {
        it("rejects when the token endpoint answers 200 with a body that is not JSON",
            async () => {
                // response.json() is not wrapped: the negative path is a rejection either way, pinned here so a
                // future fix that maps it to the domain exception still satisfies this spec.
                jest.spyOn(global,
                    "fetch").mockResolvedValue({
                        ok: true,
                        status: 200,
                        json: async () => {
                            throw new SyntaxError("Unexpected token < in JSON")
                        },
                    } as unknown as Response)
                const client = await boot()
                await expect(client.signIn("person@example.com",
                    "s3cret")).rejects.toThrow()
            })

        it("refuses an access token whose subject is empty",
            async () => {
                jest.spyOn(global,
                    "fetch").mockResolvedValue({
                        ok: true,
                        status: 200,
                        json: async () => ({
                            access_token: tokenWith({
                                sub: "" 
                            }) 
                        }),
                    } as unknown as Response)
                const client = await boot()
                await expect(client.signIn("person@example.com",
                    "s3cret")).rejects.toThrow(
                    expect.objectContaining({
                        code: "KEYCLOAK_INVALID_CREDENTIALS_EXCEPTION" 
                    }),
                )
            })

        it("refuses an access token whose payload decodes to JSON null",
            async () => {
                // 'null' parses cleanly - the refusal must come from the missing-subject check, not a parse error.
                const access_token = `e30.${Buffer.from("null").toString("base64url")}.sig`
                jest.spyOn(global,
                    "fetch").mockResolvedValue({
                        ok: true,
                        status: 200,
                        json: async () => ({
                            access_token 
                        }),
                    } as unknown as Response)
                const client = await boot()
                await expect(client.signIn("person@example.com",
                    "s3cret")).rejects.toThrow(
                    expect.objectContaining({
                        code: "KEYCLOAK_INVALID_CREDENTIALS_EXCEPTION" 
                    }),
                )
            })

        it("refuses an access token whose payload is a JSON array",
            async () => {
                const access_token = `e30.${Buffer.from("[\"person-1\"]").toString("base64url")}.sig`
                jest.spyOn(global,
                    "fetch").mockResolvedValue({
                        ok: true,
                        status: 200,
                        json: async () => ({
                            access_token 
                        }),
                    } as unknown as Response)
                const client = await boot()
                await expect(client.signIn("person@example.com",
                    "s3cret")).rejects.toThrow(
                    expect.objectContaining({
                        code: "KEYCLOAK_INVALID_CREDENTIALS_EXCEPTION" 
                    }),
                )
            })
    })

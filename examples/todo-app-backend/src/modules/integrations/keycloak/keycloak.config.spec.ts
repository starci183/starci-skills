import {
    AppConfigService,
} from "@modules/platform/config/index"
import {
    keycloakConfig,
} from "./keycloak.config"

describe("keycloak config",
    () => {
        it("reads every setting through the platform config reader at access time",
            () => {
                const source = {
                    getKeycloakTokenUrl: jest.fn().mockReturnValue("http://idp.test/token"),
                    getKeycloakClientId: jest.fn().mockReturnValue("todo-api"),
                } as unknown as AppConfigService
                const config = keycloakConfig(source)

                expect(config.tokenUrl).toEqual("http://idp.test/token")
                expect(config.clientId).toEqual("todo-api")
                expect(source.getKeycloakTokenUrl).toHaveBeenCalledTimes(1)
                expect(source.getKeycloakClientId).toHaveBeenCalledTimes(1)
            })
    })

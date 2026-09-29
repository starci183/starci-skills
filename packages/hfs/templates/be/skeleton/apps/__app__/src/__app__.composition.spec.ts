import { INestApplication } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import request from "supertest"
import { SERVER_OPTIONS } from "@modules/platform/config"
import { Logger } from "@modules/platform/logging"
import { AppModule } from "./app.module"

describe("{{app}} composition", () => {
    let app: INestApplication

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({ imports: [AppModule.register({ server: { port: 3000 } })] }).compile()
        app = moduleRef.createNestApplication()
        await app.init()
    })

    afterAll(async () => {
        await app.close()
    })

    it("boots the real AppModule and resolves its providers", () => {
        expect(app.get(Logger)).toBeInstanceOf(Logger)
        expect(app.get(SERVER_OPTIONS)).toEqual({ port: 3000 })
    })

    it("answers GET /health/live with the { status, info, error, details } shape", async () => {
        const response = await request(app.getHttpServer()).get("/health/live")
        expect(response.status).toBe(200)
        expect(response.body).toEqual({ status: "ok", info: {}, error: {}, details: {} })
    })
})

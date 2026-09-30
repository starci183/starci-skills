/**
 * The identity provider at the network edge: an HTTP server that speaks the token endpoint of a Keycloak realm (the
 * password grant the sign-in uses) and its JWKS. The persons are a directory a spec fills over the control channel; an
 * unknown email and a wrong password get the identical refusal. Access tokens are real RS256 JWTs signed with a key
 * generated for the run, carrying the person id as `sub`. The application client runs unchanged against it: only its
 * `KEYCLOAK_TOKEN_URL` points here.
 */
import { createSign, generateKeyPairSync, randomUUID, timingSafeEqual } from "node:crypto"
import { createServer } from "node:http"
import type { IncomingMessage, ServerResponse } from "node:http"
import type { FailureSpec, RecordedRequest } from "../fakes-control.contracts"
import { worldClock } from "../../kit/world-clock"
import { FailureQueue, RequestLog, answerJson, closeServer, headersOf, listenLoopback, readBody } from "../fakes-http.service"
import { renderPayload } from "../payload.service"

const REALM = "todo"
const CLIENT_ID = "todo-api"
const TOKEN_LIFETIME_SECONDS = 300
const FORM_CONTENT_TYPE = "application/x-www-form-urlencoded"

interface Person {
    readonly personId: string
    readonly password: string
}

/** Compares two secrets in constant time. */
const sameSecret = (left: string, right: string): boolean => {
    const leftBytes = Buffer.from(left)
    const rightBytes = Buffer.from(right)
    return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes)
}

const base64Url = (value: string | Buffer): string => Buffer.from(value).toString("base64url")

/** The identity provider fake. */
export class KeycloakFake {
    private readonly log = new RequestLog()
    private readonly failures = new FailureQueue()
    private readonly persons = new Map<string, Person>()
    private readonly keys = generateKeyPairSync("rsa", { modulusLength: 2048 })
    private readonly keyId = randomUUID()
    private readonly server = createServer((request, response) => {
        void this.answer(request, response)
    })
    private listening = 0

    /** Binds the loopback port. */
    async listen(): Promise<void> {
        this.listening = await listenLoopback(this.server)
    }

    /** Stops the server. */
    close(): Promise<void> {
        return closeServer(this.server)
    }

    /** The token endpoint the application is configured with. */
    get tokenUrl(): string {
        return `${this.issuer}/protocol/openid-connect/token`
    }

    /** The client id the application presents to the realm. */
    get clientId(): string {
        return CLIENT_ID
    }

    /** Registers (or re-registers) a person and answers the person id the tokens will carry as `sub`. */
    addPerson(email: string, password: string): string {
        const known = this.persons.get(email)
        const personId = known?.personId ?? randomUUID()
        this.persons.set(email, { personId, password })
        return personId
    }

    /** Arms a failure for the next token request. */
    failNext(spec: FailureSpec): void {
        this.failures.push(spec)
    }

    /** The calls received so far. */
    requests(): ReadonlyArray<RecordedRequest> {
        return this.log.all()
    }

    private get issuer(): string {
        return `http://127.0.0.1:${this.listening}/realms/${REALM}`
    }

    private async answer(request: IncomingMessage, response: ServerResponse): Promise<void> {
        const body = await readBody(request)
        const method = request.method ?? ""
        const path = request.url ?? ""
        this.log.record({ method, path, headers: headersOf(request), body })
        if (method === "GET" && path === `/realms/${REALM}/protocol/openid-connect/certs`) {
            answerJson(response, 200, { keys: [{ ...this.keys.publicKey.export({ format: "jwk" }), kid: this.keyId, alg: "RS256", use: "sig" }] })
            return
        }
        if (method !== "POST" || path !== `/realms/${REALM}/protocol/openid-connect/token`) {
            answerJson(response, 404, { error: "Not found" })
            return
        }
        const failure = this.failures.takeInbound()
        if (failure?.timeout === true) return
        if (failure?.status !== undefined) {
            answerJson(response, failure.status, { error: "server_error", error_description: "injected failure" })
            return
        }
        this.tokenRequest(request, body, response)
    }

    private tokenRequest(request: IncomingMessage, body: string, response: ServerResponse): void {
        const contentType = request.headers["content-type"] ?? ""
        const form = new URLSearchParams(body)
        if (!contentType.startsWith(FORM_CONTENT_TYPE) || form.get("grant_type") !== "password") {
            answerJson(response, 400, renderPayload("keycloak", "error-invalid-request"))
            return
        }
        const email = form.get("username") ?? ""
        const person = this.persons.get(email)
        if (form.get("client_id") !== CLIENT_ID || person === undefined || !sameSecret(person.password, form.get("password") ?? "")) {
            answerJson(response, 401, renderPayload("keycloak", "error-invalid-grant"))
            return
        }
        answerJson(
            response,
            200,
            renderPayload("keycloak", "token-response", {
                accessToken: this.accessToken(person.personId, email),
                refreshToken: randomUUID(),
                sessionState: randomUUID(),
            }),
        )
    }

    private accessToken(personId: string, email: string): string {
        const issuedAt = Math.floor(worldClock.now().getTime() / 1000)
        const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT", kid: this.keyId }))
        const claims = base64Url(
            JSON.stringify({
                exp: issuedAt + TOKEN_LIFETIME_SECONDS,
                iat: issuedAt,
                jti: randomUUID(),
                iss: this.issuer,
                aud: "account",
                sub: personId,
                typ: "Bearer",
                azp: CLIENT_ID,
                preferred_username: email,
                email,
                email_verified: true,
            }),
        )
        const signature = createSign("RSA-SHA256").update(`${header}.${claims}`).sign(this.keys.privateKey)
        return `${header}.${claims}.${base64Url(signature)}`
    }
}

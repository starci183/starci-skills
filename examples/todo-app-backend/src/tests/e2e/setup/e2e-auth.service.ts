import { createE2EHttpClient } from "@e2e-kit/integrations/http/e2e-http-client"
import type { E2EHttpClient } from "@e2e-kit/integrations/http/e2e-http-client"
import type { E2EGraphql } from "./e2e-graphql.client"
import type { E2EStack } from "./e2e-stack.service"
import { E2EError, E2EErrorCode, present } from "./e2e.error"
import type { SignInData, SignOutData } from "./e2e-views.contracts"

/** A signed-in identity the public door yielded: the bearer every later call carries, the person it belongs to and the email it signed in with. */
export interface E2ESession {
    readonly sessionToken: string
    readonly personId: string
    readonly email: string
}

/** The seeded realm identities a journey may act as: "owner" is the demo user, "other" its peer. */
export type PersonaName = "owner" | "other"

/**
 * The two identities the run-owned realm import (.starcistacks/dev/infra/compose/realm-todo.json) seeds: the same bytes the
 * dev stack ships, so a persona here is the same person a dev login is.
 */
const PERSONAS: Readonly<Record<PersonaName, { readonly email: string; readonly password: string }>> = {
    owner: { email: "demo@todo.dev", password: "todo-demo-pass" },
    other: { email: "demo2@todo.dev", password: "todo-demo-pass-2" },
}

interface AdminToken {
    readonly value: string
    readonly expiresAt: number
}

interface KeycloakUser {
    readonly id?: string
}

interface TokenBody {
    access_token?: string
    expires_in?: number
}

const REALM_USERS_PATH = "/admin/realms/todo/users"

/**
 * Identity for e2e specs: sign-in and sign-out go through the public GraphQL doors (the only doors a real client has),
 * while account create/delete go through the realm admin REST API using the run-owned admin credentials: test population
 * management, never a flow under test.
 */
export class E2EAuth {
    private readonly personas = new Map<PersonaName, E2ESession>()
    private admin: AdminToken | null = null

    constructor(
        private readonly stack: E2EStack,
        private readonly graphql: E2EGraphql,
    ) {}

    /** Signs in through the public door; a refusal is a harness failure here (specs that assert refusals call the door themselves). */
    async signIn(email: string, password: string): Promise<E2ESession> {
        const observed = await this.graphql.client().mutate<SignInData>("signIn", { variables: { input: { email, password } } })
        if (observed.errorCode !== null) throw this.failed("signIn", email, observed.errorCode)
        const signIn = present(observed.data, "signIn data").signIn
        return { sessionToken: signIn.sessionToken, personId: signIn.personId, email }
    }

    /** Ends a session through the public signOut door. */
    async signOut(sessionToken: string): Promise<void> {
        const observed = await this.graphql.client().mutate<SignOutData>("signOut", { variables: { input: { sessionToken } } })
        if (observed.errorCode !== null) throw this.failed("signOut", sessionToken, observed.errorCode)
    }

    /** A cached session for a seeded realm identity. */
    async persona(name: PersonaName): Promise<E2ESession> {
        const known = this.personas.get(name)
        if (known) return known
        const identity = PERSONAS[name]
        const session = await this.signIn(identity.email, identity.password)
        this.personas.set(name, session)
        return session
    }

    /** A brand-new session for a seeded realm identity, never the cached one: the recovery after a sign-out or an expiry. */
    signInAs(name: PersonaName): Promise<E2ESession> {
        const identity = PERSONAS[name]
        return this.signIn(identity.email, identity.password)
    }

    /** The sign-in email of a seeded realm identity. */
    personaEmail(name: PersonaName): string {
        return PERSONAS[name].email
    }

    /**
     * Creates a realm user through the Keycloak admin API and answers its realm user id, which is also the `sub` sign-in
     * yields. The account is real: signing in with the pair succeeds afterwards through the public door.
     */
    async createAccount(account: { readonly email: string; readonly password: string }): Promise<{ readonly personId: string }> {
        const response = await (await this.keycloakAdmin()).post(REALM_USERS_PATH, {
            username: account.email,
            email: account.email,
            firstName: "E2E",
            lastName: "User",
            enabled: true,
            emailVerified: true,
            requiredActions: [],
            credentials: [{ type: "password", value: account.password, temporary: false }],
        })
        if (response.status !== 201 && response.status !== 409) {
            throw this.failed("keycloak user create", account.email, `http-${response.status}`)
        }
        return { personId: await this.findUserId(account.email) }
    }

    /** Deletes a realm user by realm user id; a no-op when it is already gone. */
    async deleteAccount(personId: string): Promise<void> {
        const response = await (await this.keycloakAdmin()).delete(`${REALM_USERS_PATH}/${personId}`)
        if (response.status !== 204 && response.status !== 404) {
            throw this.failed("keycloak user delete", personId, `http-${response.status}`)
        }
    }

    private async findUserId(email: string): Promise<string> {
        const response = await (await this.keycloakAdmin()).get<Array<KeycloakUser>>(REALM_USERS_PATH, {
            params: { email, exact: "true" },
        })
        const users = Array.isArray(response.data) ? response.data : []
        return present(users[0]?.id, `keycloak user id of ${email}`)
    }

    /** An admin-API client scoped to the run-owned keycloak, bearer = cached master-realm admin token. */
    private async keycloakAdmin(): Promise<E2EHttpClient> {
        return createE2EHttpClient({ baseUrl: this.stack.keycloakUrl, bearerToken: await this.adminToken(), timeoutMs: 15_000 })
    }

    private async adminToken(): Promise<string> {
        if (this.admin && Date.now() < this.admin.expiresAt) return this.admin.value
        const response = await createE2EHttpClient({ baseUrl: this.stack.keycloakUrl, timeoutMs: 15_000 }).postForm<TokenBody>(
            "/realms/master/protocol/openid-connect/token",
            {
                grant_type: "password",
                client_id: "admin-cli",
                username: this.stack.keycloakAdmin.username,
                password: this.stack.keycloakAdmin.password,
            },
        )
        const token = present(response.data?.access_token, `keycloak admin token (http-${response.status})`)
        const expiresIn = response.data?.expires_in ?? 60
        this.admin = { value: token, expiresAt: Date.now() + Math.max(expiresIn - 15, 5) * 1000 }
        return token
    }

    private failed(operation: string, subject: string, code: string): E2EError {
        return new E2EError({ code: E2EErrorCode.StackFailed, params: { detail: `${operation} for ${subject} answered ${code}` } })
    }
}

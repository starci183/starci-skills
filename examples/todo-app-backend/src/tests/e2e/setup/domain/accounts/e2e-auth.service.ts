import {
    createE2EHttpClient, E2EHttpClient 
} from "@e2e-kit/integrations/http/e2e-http-client"
import {
    Injectable 
} from "@nestjs/common"
import {
    E2EHttpService 
} from "../../integrations/http/e2e-http.service"
import {
    E2EStackService 
} from "../../platform/stack/e2e-stack.service"

/**
 * A signed-in identity the public door yielded: the bearer every later call carries, the person it
 * belongs to, and the email it signed in with.
 */
export interface E2ESession {
  readonly sessionToken: string;
  /** Alias of sessionToken - both spellings landed in lane specs before the contract froze. */
  readonly token: string;
  readonly personId: string;
  readonly email: string;
}

/** The seeded realm identities a journey may act as - "owner" is the demo user, "other" its peer. */
export type PersonaName = "owner" | "other";

/**
 * The two identities the run-owned realm import (.starcistacks/dev/infra/compose/realm-todo.json)
 * seeds - the same bytes the dev stack ships, so a persona here is the same person a dev login is.
 */
const PERSONAS: Record<PersonaName, { email: string; password: string }> = {
    owner: {
        email: "demo@todo.dev", password: "todo-demo-pass" 
    },
    other: {
        email: "demo2@todo.dev", password: "todo-demo-pass-2" 
    },
}

interface AdminToken {
  readonly value: string;
  readonly expiresAt: number;
}

interface KeycloakUser {
  readonly id?: string;
}

@Injectable()
/**
 * Identity for e2e specs: sign-in and session revocation go through the public GraphQL doors (the
 * only doors a real client has), while account create/delete go through the realm's admin REST API
 * using the run-owned admin credentials - test population management, never a flow under test.
 */
export class E2EAuthService {
    private readonly sessions = new Map<string, E2ESession>()
    private admin: AdminToken | null = null

    constructor(
    private readonly stack: E2EStackService,
    private readonly http: E2EHttpService,
    ) {}

    /** Signs in through the public door and keeps the session token; throws if no token comes back. */
    async signIn(email: string, password: string): Promise<E2ESession> {
        const observed = await this.http.graphql<{ signIn: { sessionToken: string; personId: string } }>(
            "signIn",
            {
                variables: {
                    input: {
                        email, password 
                    } 
                } 
            },
        )
        const sessionToken = observed.data?.signIn?.sessionToken
        if (!sessionToken) {
            throw new Error(
                `sign-in for ${email} did not yield a sessionToken: ${observed.errorCode ?? observed.errorMessage ?? "no error"}`,
            )
        }
        return {
            sessionToken, token: sessionToken, personId: observed.data!.signIn.personId, email 
        }
    }

    /** Ends a session through the public signOut door; throws when the door refuses or stays silent. */
    async revokeSession(sessionToken: string): Promise<void> {
        const observed = await this.http.graphql<{ signOut: { signedOut: boolean } }>(
            "signOut",
            {
                variables: {
                    input: {
                        sessionToken 
                    } 
                } 
            },
        )
        if (!observed.data?.signOut?.signedOut) {
            throw new Error(
                `signOut did not confirm revocation: ${observed.errorCode ?? observed.errorMessage ?? "no error"}`,
            )
        }
    }

    /** A cached session for a seeded realm identity. */
    async persona(name: PersonaName): Promise<E2ESession> {
        const known = this.sessions.get(name)
        if (known) return known
        const identity = PERSONAS[name]
        if (!identity) throw new Error(`unknown persona ${name}`)
        const session = await this.signIn(identity.email,
            identity.password)
        this.sessions.set(name,
            session)
        return session
    }

    /** Drops a cached persona session so a later step sees what an unauthenticated caller sees. */
    forgetPersona(name: PersonaName): void {
        this.sessions.delete(name)
    }

    personaEmail(name: PersonaName): string {
        return PERSONAS[name].email
    }

    /**
   * Creates a realm user through the Keycloak admin API and returns { personId } - the realm user id,
   * which is also the `sub` sign-in yields. The account is real: signIn with the pair succeeds
   * afterwards through the public door.
   */
    async register(account: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
  }): Promise<{ personId: string }> {
        const response = await (await this.kcAdmin()).post("/admin/realms/todo/users",
            {
                username: account.email,
                email: account.email,
                firstName: account.firstName ?? "E2E",
                lastName: account.lastName ?? "User",
                enabled: true,
                emailVerified: true,
                requiredActions: [],
                credentials: [{
                    type: "password", value: account.password, temporary: false 
                }],
            })
        if (response.status !== 201 && response.status !== 409) {
            throw new Error(`keycloak user create for ${account.email} failed (${response.status}): ${JSON.stringify(response.data).slice(0,
                400)}`)
        }
        return {
            personId: await this.findUserId(account.email) 
        }
    }

    /** Earlier name for register() - kept for specs written before the accounts contract settled. */
    async createAccount(account: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
  }): Promise<{ personId: string }> {
        return this.register(account)
    }

    /** Deletes a realm user by personId (realm user id) or by email; a no-op when already gone. */
    async deleteAccount(personIdOrEmail: string): Promise<void> {
        const id = /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(personIdOrEmail)
            ? personIdOrEmail
            : await this.findUserId(personIdOrEmail)
        if (!id) return
        const response = await (await this.kcAdmin()).delete(`/admin/realms/todo/users/${id}`)
        if (response.status !== 204 && response.status !== 404) {
            throw new Error(`keycloak user delete for ${personIdOrEmail} failed (${response.status}): ${JSON.stringify(response.data).slice(0,
                400)}`)
        }
    }

    private async findUserId(email: string): Promise<string> {
        const response = await (await this.kcAdmin()).get<Array<KeycloakUser>>("/admin/realms/todo/users",
            {
                params: {
                    email, exact: "true" 
                },
            })
        const users = Array.isArray(response.data) ? response.data : []
        return users[0]?.id ?? ""
    }

    /** An admin-API client scoped to the run-owned keycloak, bearer = cached master-realm admin token. */
    private async kcAdmin(): Promise<E2EHttpClient> {
        return createE2EHttpClient({
            baseUrl: this.stack.keycloakUrl,
            bearerToken: await this.adminToken(),
            timeoutMs: 15_000,
        })
    }

    private async adminToken(): Promise<string> {
        if (this.admin && Date.now() < this.admin.expiresAt) return this.admin.value
        const response = await createE2EHttpClient({
            baseUrl: this.stack.keycloakUrl, timeoutMs: 15_000 
        }).postForm<{
      access_token?: string;
      expires_in?: number;
    }>("/realms/master/protocol/openid-connect/token",
        {
            grant_type: "password",
            client_id: "admin-cli",
            username: this.stack.keycloakAdmin.username,
            password: this.stack.keycloakAdmin.password,
        })
        const token = response.data?.access_token
        if (!token) {
            throw new Error(`keycloak admin token refused (${response.status}): ${JSON.stringify(response.data).slice(0,
                300)}`)
        }
        const expiresIn = response.data?.expires_in ?? 60
        this.admin = {
            value: token, expiresAt: Date.now() + Math.max(expiresIn - 15,
                5) * 1000 
        }
        return token
    }
}

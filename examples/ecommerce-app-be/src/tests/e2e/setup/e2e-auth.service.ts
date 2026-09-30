import { randomUUID } from "node:crypto"
import type { E2EDatabase } from "./e2e-database.service"
import type { E2EGraphql } from "./e2e-graphql.client"
import { E2EError, E2EErrorCode, present } from "./e2e.error"
import type { RegisterData, SignInData } from "./e2e-views.contracts"

/** A person a spec created and signed in: id, email and the live session token. */
export interface E2ESession {
    personId: string
    email: string
    sessionToken: string
}

/**
 * Test-account lifecycle. Accounts are created through the identity service own public doors (there is no external
 * identity provider: the person is the persons row); deletion is out-of-band so a spec can guarantee its rows are gone
 * without a delete door the product does not expose.
 */
export class E2EAuth {
    constructor(
        private readonly graphql: E2EGraphql,
        private readonly database: E2EDatabase,
    ) {}

    /** Registers a person and signs them in; the email is unique per call. */
    async registerBuyer(tag: string, password: string): Promise<E2ESession> {
        const email = `e2e-${tag}-${randomUUID()}@ecommerce.dev`
        const registered = await this.graphql.client("identity").mutate<RegisterData>("register", { variables: { input: { email, password } } })
        if (registered.errorCode !== null) throw this.failed("register", email, registered.errorCode)
        present(registered.data, "register data")
        return this.signIn(email, password)
    }

    /** Signs an existing person in. */
    async signIn(email: string, password: string): Promise<E2ESession> {
        const response = await this.graphql.client("identity").mutate<SignInData>("signIn", { variables: { input: { email, password } } })
        if (response.errorCode !== null) throw this.failed("signIn", email, response.errorCode)
        const signIn = present(response.data, "signIn data").signIn
        return { personId: signIn.personId, email, sessionToken: signIn.sessionToken }
    }

    /** Removes a person out-of-band; sessions in redis die with the container anyway. */
    deleteAccount(personId: string): Promise<void> {
        return this.database.deletePerson(personId)
    }

    private failed(operation: string, email: string, code: string): E2EError {
        return new E2EError({ code: E2EErrorCode.StackFailed, params: { detail: `${operation} for ${email} answered ${code}` } })
    }
}

import {
    Injectable 
} from "@nestjs/common"
import {
    E2EDbService 
} from "../../platform/databases/e2e-db.service"
import {
    E2EGraphqlService 
} from "../../integrations/graphql/e2e-graphql.service"

/** A person the spec created: id and email, enough to assert and to clean up. */
export interface E2EAccount {
  personId: string;
  email: string;
}

/** An account plus the live session token sign-in issued for it. */
export interface E2ESession extends E2EAccount {
  sessionToken: string;
}

/** The register mutation's payload as the door answers it. */
interface RegisterPayload { personId?: string }

/** The register mutation's data envelope. */
interface RegisterData { register?: RegisterPayload }

/** The signIn mutation's payload: the bearer token and the person it resolves to. */
interface SignInPayload { sessionToken?: string; personId?: string }

/** The signIn mutation's data envelope. */
interface SignInData { signIn?: SignInPayload }

@Injectable()
/**
 * Test-account lifecycle for the suite. Accounts are created through the identity service's own
 * public register door - the anonymous `register` mutation on its /graphql transport, the
 * canonical home for the user-facing API (there is no external IdP in this stack - the person IS
 * the identity_person row); deletion is out-of-band through the db service, so a spec can
 * guarantee its rows are gone without relying on a delete endpoint the product does not expose.
 */
export class E2EAuthService {
    constructor(
    private readonly graphql: E2EGraphqlService,
    private readonly db: E2EDbService,
    ) {}

    async register(email: string, password: string): Promise<E2EAccount> {
        const response = await this.graphql.client("identity").mutate<RegisterData>("register",
            {
                variables: {
                    input: {
                        email, password 
                    } 
                } 
            })
        const personId = response.data?.register?.personId
        if (response.errorCode || !personId) {
            throw new Error(`register for ${email} failed: ${response.errorCode} ${JSON.stringify(response.data).slice(0,
                300)}`)
        }
        return {
            personId, email 
        }
    }

    async signIn(email: string, password: string): Promise<E2ESession> {
        const response = await this.graphql
            .client("identity")
            .mutate<SignInData>("signIn",
                {
                    variables: {
                        input: {
                            email, password 
                        } 
                    } 
                })
        const signIn = response.data?.signIn
        if (response.errorCode || !signIn?.sessionToken || !signIn.personId) {
            throw new Error(`sign-in for ${email} failed: ${response.errorCode} ${JSON.stringify(response.data).slice(0,
                300)}`)
        }
        return {
            personId: signIn.personId, email, sessionToken: signIn.sessionToken 
        }
    }

    /** Out-of-band delete of the person row; sessions in redis die with the container anyway. */
    async deleteAccount(personId: string): Promise<void> {
        await this.db.query("delete from identity_person where id = $1",
            [personId])
    }
}

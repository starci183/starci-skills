import { Injectable } from "@nestjs/common"
import { EntityManager } from "typeorm"
import { SessionService } from "@modules/domain/session"
import type { IssuedSession } from "@modules/domain/session"
import { InjectOrderApi } from "@modules/integrations/order-api"
import type { OrderApiClient } from "@modules/integrations/order-api"
import { InjectIdentityEntityManager } from "@modules/platform/database"
import { ok, refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import type {
    AccountOverview,
    AccountOverviewParams,
    AccountPersonView,
    AccountView,
    GetAccountParams,
    RegisterPersonParams,
    SignInParams,
    VerifyCredentialsParams,
} from "./account.contracts"
import { AccountErrorCode } from "./errors/account.error"
import { hashPassword, verifyPassword } from "./password.policy"
import { toPersonId } from "./persistence/account.rows"
import type { PersonIdRow } from "./persistence/account.rows"
import { INSERT_PERSON_IF_NEW } from "./persistence/account.sql"
import { PersonEntity } from "./persistence/entities/person.entity"

@Injectable()
/** Credential checking, registration, sign-in and the account behind a person id. Refusals are returned, never thrown. */
export class AccountService {
    constructor(
        @InjectIdentityEntityManager() private readonly entityManager: EntityManager,
        private readonly sessions: SessionService,
        @InjectOrderApi() private readonly orderApi: OrderApiClient,
    ) {}

    /** The person whose email and password match; unknown email and wrong password are the same refusal. */
    async verifyCredentials(
        params: VerifyCredentialsParams,
    ): Promise<Outcome<AccountPersonView, AccountErrorCode.InvalidCredentials>> {
        const person = await this.entityManager.findOneBy(PersonEntity, { email: params.email })
        if (!person || !verifyPassword(params.password, person.passwordHash)) {
            return refused(AccountErrorCode.InvalidCredentials)
        }
        return ok({ personId: person.id })
    }

    /** Checks the credentials and starts a session; a wrong email and a wrong password are the same refusal. */
    async signIn(params: SignInParams): Promise<Outcome<IssuedSession, AccountErrorCode.InvalidCredentials>> {
        const verified = await this.verifyCredentials(params)
        if (verified.kind === "refused") return verified
        return ok(await this.sessions.issue({ personId: verified.value.personId }))
    }

    /** Registers a person in one transaction; a taken email is a refusal. */
    async register(params: RegisterPersonParams): Promise<Outcome<AccountPersonView, AccountErrorCode.EmailTaken>> {
        return this.entityManager.transaction(async (manager) => {
            const rows: Array<PersonIdRow> = await manager.query(INSERT_PERSON_IF_NEW, [
                params.email,
                hashPassword(params.password),
            ])
            const personId = toPersonId(rows)
            return personId === null ? refused(AccountErrorCode.EmailTaken) : ok({ personId })
        })
    }

    /** The account of one person. */
    async getAccount(params: GetAccountParams): Promise<Outcome<AccountView, AccountErrorCode.PersonUnknown>> {
        const person = await this.entityManager.findOneBy(PersonEntity, { id: params.personId })
        return person ? ok({ personId: person.id, email: person.email }) : refused(AccountErrorCode.PersonUnknown)
    }

    /**
     * The account joined with the buyer status read live from the order service. An unreachable order service fails
     * the read with its own error: an outage never degrades into hasOrders false, which would look like an answer.
     */
    async overview(params: AccountOverviewParams): Promise<Outcome<AccountOverview, AccountErrorCode.PersonUnknown>> {
        const account = await this.getAccount({ personId: params.personId })
        if (account.kind === "refused") return account
        const buyer = await this.orderApi.getBuyerStatus(params.sessionToken)
        return ok({ personId: account.value.personId, email: account.value.email, hasOrders: buyer.hasOrders })
    }
}

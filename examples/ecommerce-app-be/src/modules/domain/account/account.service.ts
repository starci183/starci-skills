import { Injectable } from "@nestjs/common"
import { EntityManager } from "typeorm"
import { InjectIdentityEntityManager } from "@modules/platform/database"
import { ok, refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import type {
    AccountPersonView,
    AccountView,
    GetAccountParams,
    RegisterPersonParams,
    VerifyCredentialsParams,
} from "./account.contracts"
import { AccountErrorCode } from "./errors/account.error"
import { hashPassword, verifyPassword } from "./password.policy"
import { toPersonId } from "./persistence/account.rows"
import type { PersonIdRow } from "./persistence/account.rows"
import { INSERT_PERSON_IF_NEW } from "./persistence/account.sql"
import { PersonEntity } from "./persistence/entities/person.entity"

@Injectable()
/** Credential checking, registration and the account behind a person id. Refusals are returned, never thrown. */
export class AccountService {
    constructor(@InjectIdentityEntityManager() private readonly entityManager: EntityManager) {}

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

    /** Registers a person inside the caller transaction; a taken email is a refusal. */
    async register(params: RegisterPersonParams): Promise<Outcome<AccountPersonView, AccountErrorCode.EmailTaken>> {
        const rows: Array<PersonIdRow> = await params.manager.query(INSERT_PERSON_IF_NEW, [
            params.email,
            hashPassword(params.password),
        ])
        const personId = toPersonId(rows)
        return personId === null ? refused(AccountErrorCode.EmailTaken) : ok({ personId })
    }

    /** The account of one person. */
    async getAccount(params: GetAccountParams): Promise<Outcome<AccountView, AccountErrorCode.PersonUnknown>> {
        const person = await this.entityManager.findOneBy(PersonEntity, { id: params.personId })
        return person ? ok({ personId: person.id, email: person.email }) : refused(AccountErrorCode.PersonUnknown)
    }
}

import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectSessionService } from "@modules/domain/session"
import type { IssuedSession, SessionService } from "@modules/domain/session"
import { InjectKeycloak, KeycloakError, KeycloakErrorCode } from "@modules/integrations/keycloak"
import type { KeycloakClient, KeycloakSignIn } from "@modules/integrations/keycloak"
import { InjectKeycloakAdmin, KeycloakAdminErrorCode } from "@modules/integrations/keycloak-admin"
import type { KeycloakAdmin } from "@modules/integrations/keycloak-admin"
import { InjectOrderApi } from "@modules/integrations/order-api"
import type { OrderApiClient } from "@modules/integrations/order-api"
import { InjectIdentityEntityManager } from "@modules/platform/database"
import { ok, refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import type {
    AccountCredentials,
    AccountOverview,
    AccountOverviewParams,
    AccountPersonView,
    AccountView,
    GetAccountParams,
} from "./account.contracts"
import { AccountErrorCode } from "./errors/account.error"
import { INSERT_PERSON_IF_NEW } from "./persistence/account.sql"
import { PersonEntity } from "./persistence/entities/person.entity"

/** How each failure of the password grant is told to the caller: a wrong pair stays uniform, an outage is its own answer. */
const SIGN_IN_REFUSAL_OF: Record<
    KeycloakErrorCode,
    AccountErrorCode.InvalidCredentials | AccountErrorCode.ProviderUnavailable
> = {
    [KeycloakErrorCode.InvalidCredentials]: AccountErrorCode.InvalidCredentials,
    [KeycloakErrorCode.ProviderUnavailable]: AccountErrorCode.ProviderUnavailable,
}

/** How each refusal of the realm's admin API is told to the caller. */
const REGISTER_REFUSAL_OF: Record<
    KeycloakAdminErrorCode,
    AccountErrorCode.EmailTaken | AccountErrorCode.ProviderUnavailable
> = {
    [KeycloakAdminErrorCode.EmailTaken]: AccountErrorCode.EmailTaken,
    [KeycloakAdminErrorCode.Unavailable]: AccountErrorCode.ProviderUnavailable,
}

@Injectable()
/**
 * The shoppers of the product. Keycloak owns every credential: registering creates the shopper in the realm through the
 * admin API, and signing in is the realm's password grant; the product keeps only the person row (the realm's subject is
 * its id) and the session the sign-in opens. The provider is called before any write, so a refused or unreachable realm
 * leaves nothing behind.
 */
export class AccountService {
    constructor(
        @InjectIdentityEntityManager() private readonly entityManager: EntityManager,
        @InjectSessionService() private readonly sessions: SessionService,
        @InjectKeycloak() private readonly keycloak: KeycloakClient,
        @InjectKeycloakAdmin() private readonly keycloakAdmin: KeycloakAdmin,
        @InjectOrderApi() private readonly orderApi: OrderApiClient,
    ) {}

    /** Creates the shopper in the realm and records the person under the subject the realm gave it. */
    async register(
        params: AccountCredentials,
    ): Promise<Outcome<AccountPersonView, AccountErrorCode.EmailTaken | AccountErrorCode.ProviderUnavailable>> {
        const created = await this.keycloakAdmin.createMember({ email: params.email, password: params.password })
        if (created.kind === "refused") return refused(REGISTER_REFUSAL_OF[created.code])
        await this.entityManager.query(INSERT_PERSON_IF_NEW, [created.value.id, params.email])
        return ok({ personId: created.value.id })
    }

    /**
     * Signs the shopper in with the realm's password grant and opens a session that keeps the refresh token. A person the
     * realm vouches for but the product has not met yet (a user created in the realm directly) is recorded on the way.
     */
    async signIn(
        params: AccountCredentials,
    ): Promise<Outcome<IssuedSession, AccountErrorCode.InvalidCredentials | AccountErrorCode.ProviderUnavailable>> {
        const granted = await this.grant(params)
        if (granted.kind === "refused") return granted
        const { subject, refreshToken } = granted.value
        await this.entityManager.query(INSERT_PERSON_IF_NEW, [subject, params.email])
        return ok(await this.sessions.issue({ personId: subject, providerRefreshToken: refreshToken }))
    }

    /** The realm's password grant, its failures told as the account's own refusals. */
    private async grant(
        params: AccountCredentials,
    ): Promise<Outcome<KeycloakSignIn, AccountErrorCode.InvalidCredentials | AccountErrorCode.ProviderUnavailable>> {
        try {
            return ok(await this.keycloak.signIn({ email: params.email, password: params.password }))
        } catch (error) {
            if (error instanceof KeycloakError) return refused(SIGN_IN_REFUSAL_OF[error.code])
            throw error
        }
    }

    /** The person's id and email. */
    async getAccount(params: GetAccountParams): Promise<Outcome<AccountView, AccountErrorCode.PersonUnknown>> {
        const person = await this.entityManager.findOneBy(PersonEntity, { id: params.personId })
        return person ? ok({ personId: person.id, email: person.email }) : refused(AccountErrorCode.PersonUnknown)
    }

    /** The person's account joined with the buyer status the order service reports for the caller's token. */
    async overview(params: AccountOverviewParams): Promise<Outcome<AccountOverview, AccountErrorCode.PersonUnknown>> {
        const account = await this.getAccount({ personId: params.personId })
        if (account.kind === "refused") return account
        const buyer = await this.orderApi.getBuyerStatus(params.sessionToken)
        return ok({ personId: account.value.personId, email: account.value.email, hasOrders: buyer.hasOrders })
    }
}

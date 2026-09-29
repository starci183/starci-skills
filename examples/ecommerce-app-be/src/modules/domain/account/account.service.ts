import {
    Injectable 
} from "@nestjs/common"
import {
    EntityManager 
} from "typeorm"
import {
    PersonEntity 
} from "ecommerce-app-be/modules/platform/databases/postgresql/identity"
import {
    InjectPrimaryEntityManager 
} from "ecommerce-app-be/modules/platform/databases/postgresql/identity"
import {
    isRecord 
} from "ecommerce-app-be/modules/platform/primitives"
import {
    PasswordPolicy 
} from "./password.policy"

/** Postgres' SQLSTATE for a unique-constraint violation: the one save failure that means "this address is taken". */
const UNIQUE_VIOLATION = "23505"

/** Whether a failed save was the unique-email constraint (TypeORM copies the driver's fields onto its error and also keeps the driver error). */
const isUniqueViolation = (error: unknown): boolean =>
    isRecord(error) && (error.code === UNIQUE_VIOLATION || (isRecord(error.driverError) && error.driverError.code === UNIQUE_VIOLATION))

/**
 * The account read model a door answers: the person id and the email they registered with -
 * never the password hash, which never leaves this service.
 */
export interface AccountResult {
  personId: string;
  email: string;
}

/** Person id when credentials or registration succeed; null asks the door to refuse. */
export type CredentialPersonResult = string | null
/** Account view when the person exists; null asks the door to answer unknown. */
export type AccountLookupResult = AccountResult | null

@Injectable()
/**
 * br.identity.sign-in: credential checking and the person behind it. Refusals come back as
 * nulls for the caller to turn into its own refusal; no half of the pair is ever named.
 * Persistence goes through the primary EntityManager - the capability owns behaviour, the
 * databases module owns the connection.
 */
export class AccountService {
    constructor(
    @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
    private readonly passwords: PasswordPolicy,
    ) {}

    async verifyCredentials(email: string, password: string): Promise<CredentialPersonResult> {
        const person = await this.entityManager.findOneBy(PersonEntity,
            {
                email 
            })
        if (!person) return null
        return this.passwords.verify(password,
            person.passwordHash) ? person.id : null
    }

    /**
     * The signup door: a visitor becomes a person here, and a buyer at checkout confirmation.
     * Returns null for a taken address - the unique-email violation only; any other failure is
     * rethrown so a dead database never reads as "taken" (the caller answers 409; no timing side channel matters
     * for a public door, but the row is never half-written - one insert or none).
     */
    async register(email: string, password: string): Promise<CredentialPersonResult> {
        const person = new PersonEntity()
        person.email = email
        person.passwordHash = this.passwords.hash(password)
        try {
            const saved = await this.entityManager.save(person)
            return saved.id
        } catch (error) {
            if (isUniqueViolation(error)) return null
            throw error
        }
    }

    async getAccount(personId: string): Promise<AccountLookupResult> {
        const person = await this.entityManager.findOneBy(PersonEntity,
            {
                id: personId 
            })
        return person ? {
            personId: person.id, email: person.email 
        } : null
    }
}

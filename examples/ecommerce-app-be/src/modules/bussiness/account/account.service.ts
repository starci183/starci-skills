import {
    Injectable 
} from "@nestjs/common"
import {
    EntityManager 
} from "typeorm"
import {
    PersonEntity 
} from "@modules/platform/databases/postgresql/identity/entities/person.entity"
import {
    InjectPrimaryEntityManager 
} from "@modules/platform/databases/postgresql/identity/primary.decorators"
import {
    PasswordPolicy 
} from "./password.policy"

/**
 * The account read model a door answers: the person id and the email they registered with -
 * never the password hash, which never leaves this service.
 */
export interface AccountResult {
  personId: string;
  email: string;
}

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

    async verifyCredentials(email: string, password: string): Promise<string | null> {
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
     * Returns null for a taken address (the caller answers 409; no timing side channel matters
     * for a public door, but the row is never half-written - one insert or none).
     */
    async register(email: string, password: string): Promise<string | null> {
        const person = new PersonEntity()
        person.email = email
        person.passwordHash = this.passwords.hash(password)
        try {
            const saved = await this.entityManager.save(person)
            return saved.id
        } catch {
            return null
        }
    }

    async getAccount(personId: string): Promise<AccountResult | null> {
        const person = await this.entityManager.findOneBy(PersonEntity,
            {
                id: personId 
            })
        return person ? {
            personId: person.id, email: person.email 
        } : null
    }
}

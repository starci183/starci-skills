import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PersonEntity, POSTGRESQL_PRIMARY } from '../../platform/databases/postgresql/primary';
import { PasswordPolicy } from './password.policy';

export interface AccountResult {
  personId: string;
  email: string;
}

/** br.identity.sign-in: credential checking and the person behind it. Refusals come back as
 * nulls for the caller to turn into its own refusal; no half of the pair is ever named. */
@Injectable()
export class AccountService {
  constructor(
    @InjectRepository(PersonEntity, POSTGRESQL_PRIMARY) private readonly people: Repository<PersonEntity>,
    private readonly passwords: PasswordPolicy,
  ) {}

  async verifyCredentials(email: string, password: string): Promise<string | null> {
    const person = await this.people.findOneBy({ email });
    if (!person) return null;
    return this.passwords.verify(password, person.passwordHash) ? person.id : null;
  }

  /** The signup door: a visitor becomes a person here, and a buyer at checkout confirmation.
   * Returns null for a taken address (the caller answers 409; no timing side channel matters
   * for a public door, but the row is never half-written - one insert or none). */
  async register(email: string, password: string): Promise<string | null> {
    const person = new PersonEntity();
    person.email = email;
    person.passwordHash = this.passwords.hash(password);
    try {
      const saved = await this.people.save(person);
      return saved.id;
    } catch {
      return null;
    }
  }

  async getAccount(personId: string): Promise<AccountResult | null> {
    const person = await this.people.findOneBy({ id: personId });
    return person ? { personId: person.id, email: person.email } : null;
  }
}

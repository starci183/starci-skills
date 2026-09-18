import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PersonRecord } from './person-record.types';
import { PersonNotFoundException } from './session.exception';

/**
 * data.login.person: email is unique across every person, compared lowercased; passwordHash is never
 * read back out of the product. This in-memory store stands in for integration.login.postgres, which is
 * still todo (no migration has run against a real server yet).
 */
@Injectable()
export class PersonRepository {
  private readonly byEmail = new Map<string, PersonRecord>();

  register(email: string, passwordHash: string): PersonRecord {
    const record = new PersonRecord(randomUUID(), email.toLowerCase(), passwordHash);
    this.byEmail.set(record.email, record);
    return record;
  }

  findByEmail(email: string): PersonRecord {
    const record = this.byEmail.get(email.toLowerCase());
    if (!record) {
      throw new PersonNotFoundException();
    }
    return record;
  }
}

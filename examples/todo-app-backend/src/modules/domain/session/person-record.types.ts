export class PersonRecord {
  constructor(
    readonly id: string,
    readonly email: string,
    readonly passwordHash: string,
  ) {}
}

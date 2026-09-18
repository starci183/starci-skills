export class SessionRecord {
  constructor(
    readonly token: string,
    readonly personId: string,
    readonly issuedAt: Date,
    readonly expiresAt: Date,
  ) {}
}

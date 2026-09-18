export class SignInResponse {
  personId: string;
  sessionToken: string;

  constructor(personId: string, sessionToken: string) {
    this.personId = personId;
    this.sessionToken = sessionToken;
  }
}

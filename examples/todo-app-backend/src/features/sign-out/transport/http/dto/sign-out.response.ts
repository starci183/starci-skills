export class SignOutResponse {
  signedOut: boolean;

  constructor(signedOut: boolean) {
    this.signedOut = signedOut;
  }
}

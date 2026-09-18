import { Injectable } from '@nestjs/common';
import { CompletionAuthority, OwnerOnlyCompletionAuthority } from './completion-authority';

/**
 * Holds the one active CompletionAuthority for complete/reopen. Defaults to owner-only; a future `share`
 * feature replaces it by calling `register` with a widened authority from its own Nest module. Unlike
 * TaskCreationPolicyRegistry (a list every policy must pass), eligibility for complete/reopen is a single
 * decision, so the most recently registered authority replaces rather than chains with the default.
 */
@Injectable()
export class CompletionAuthorityRegistry {
  private authority: CompletionAuthority = new OwnerOnlyCompletionAuthority();

  register(authority: CompletionAuthority): void {
    this.authority = authority;
  }

  current(): CompletionAuthority {
    return this.authority;
  }
}

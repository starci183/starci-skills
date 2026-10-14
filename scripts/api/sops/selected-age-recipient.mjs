// selected-age-recipient.mjs - public recipient derivation for app secret initialization.
import { selectedAgeRecipient as selectedRecipient } from './lib.mjs';

/** Return a public recipient or a typed refusal; selected inline identity bytes never leave the owner. */
export function selectedAgeRecipient(options = {}) {
  return selectedRecipient(options);
}

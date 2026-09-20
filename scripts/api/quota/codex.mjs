// scripts/api/quota/codex.mjs — codex is orca-managed; quota/viability comes
// from the orca account rate-limit entry for provider 'codex'.
import { probeOrcaAccount } from './orca-account.mjs';

export const probe = () => probeOrcaAccount('codex');

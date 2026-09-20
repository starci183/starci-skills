// scripts/api/quota/claude.mjs — claude is orca-managed; quota/viability comes
// from the orca account rate-limit entry for provider 'claude'.
import { probeOrcaAccount } from './orca-account.mjs';

export const probe = () => probeOrcaAccount('claude');

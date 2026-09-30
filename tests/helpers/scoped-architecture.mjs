// The architecture machine for a spec about something else (an ESLint aggregate, an adapter, subject selection): the real
// checkArchitecture, minus the findings of the HFS machine (tier direction, reachability, required files, size, clones,
// the backend composition and data machine, the frontend repository machine). Those have their own specs, and a
// fixture that exercises an aggregate is not a complete HFS tree. The rules the spec's obligations name still run for real.
import { checkArchitecture, HFS_MACHINE_RULE_IDS } from '../../scripts/checks/architecture/index.mjs';

const machine = new Set(HFS_MACHINE_RULE_IDS);
const isMachine = (ruleId) => machine.has(ruleId) || String(ruleId).startsWith('HFS_');

export function architectureWithoutMachine(input) {
  const report = checkArchitecture(input);
  const violations = report.violations.filter((item) => !isMachine(item.ruleId));
  return { ...report, violations, ok: report.errors.length === 0 && violations.length === 0 };
}

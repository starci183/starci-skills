export const UAT_DEFAULTS = { access: 'authenticated', fixtures: 'seeded', sourceRoles: 'full' };
export const uatModes = value => Object.fromEntries(Object.entries(UAT_DEFAULTS).map(([key, fallback]) => [key, value?.[key] ?? fallback]));
export function uatModeErrors(expected, actual, label) {
  const errors = [], modes = uatModes(expected), observed = uatModes(actual);
  for (const key of Object.keys(modes)) if (modes[key] !== observed[key]) errors.push(`${label}: ${key} differs from the frozen UAT prerequisites`);
  return errors;
}
export function uatCasePrerequisiteErrors(flow, cases) {
  const errors = [], modes = uatModes(flow);
  if (modes.access === 'anonymous' && flow.actorAliases?.length) errors.push('anonymous flow must not declare account aliases');
  if (modes.fixtures === 'none' && flow.namespace !== null) errors.push('no-fixture flow must have null seed namespace');
  for (const row of cases) {
    if (modes.access === 'anonymous' ? row.actor !== 'anonymous' : !flow.actorAliases?.includes(row.actor)) errors.push(`case ${row.caseId}: actor differs from the frozen flow access`);
    if (modes.fixtures === 'none' ? row.fixture !== null : row.fixture?.createsAssertedOutcome !== false) errors.push(`case ${row.caseId}: fixture differs from the frozen flow prerequisites`);
    if (modes.fixtures === 'none' && row.cleanup !== 'none') errors.push(`case ${row.caseId}: no-fixture cleanup must be none`);
  }
  return errors;
}

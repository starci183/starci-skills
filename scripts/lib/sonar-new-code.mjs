// sonar-new-code.mjs - the New Code definition a Sonar project is ensured with, and how each provider stores and reads it back. Pure.
// Without a New Code definition a SonarQube Cloud project's gate status is NONE and the scanner's quality-gate wait reports the gate
// "not set" (alpha.27: two example projects carried the gate but no New Code definition). The canonical
// period is knowledge/sonar-gate.yaml `gate.newCodePeriod` of the repository's edition; a stack target may declare its own
// `resource.newCodePeriod` of the same shape. SonarQube Server and Community Build store it through api/new_code_periods; SonarQube
// Cloud has no such web service and keeps it as the project setting `sonar.leak.period` (a number of days, or `previous_version`).

/** The period types a declaration may name, and whether each carries a value. */
const NEW_CODE_TYPES = Object.freeze({ NUMBER_OF_DAYS: 'days', PREVIOUS_VERSION: 'none' });
/** The setting SonarQube Cloud keeps a project's New Code definition in. */
export const CLOUD_NEW_CODE_SETTING = 'sonar.leak.period';
const MAX_DAYS = 90;

/** A period of a closed shape: {type: NUMBER_OF_DAYS, value: 1..90} or {type: PREVIOUS_VERSION}; throws on anything else. */
export function newCodePeriodOf(period) {
  if (!period || typeof period !== 'object' || Array.isArray(period)) throw new Error('Invalid declared new code period');
  const keys = Object.keys(period);
  if (!keys.every((key) => key === 'type' || key === 'value') || !Object.hasOwn(NEW_CODE_TYPES, period.type)) throw new Error('Invalid declared new code period');
  if (period.type === 'PREVIOUS_VERSION') {
    if (period.value !== undefined) throw new Error('Invalid declared new code period');
    return { type: 'PREVIOUS_VERSION' };
  }
  if (!Number.isInteger(period.value) || period.value < 1 || period.value > MAX_DAYS) throw new Error('Invalid declared new code period');
  return { type: 'NUMBER_OF_DAYS', value: period.value };
}

/** The period a project target is ensured with: its own `resource.newCodePeriod` when declared, else the canonical one of the gate. */
export function declaredNewCodePeriod(resource, canonical) {
  return newCodePeriodOf(resource?.newCodePeriod ?? canonical);
}

/** The value SonarQube Cloud stores in `sonar.leak.period` for `period`. */
export const cloudLeakValue = (period) => (period.type === 'PREVIOUS_VERSION' ? 'previous_version' : String(period.value));

/**
 * The write that sets `period` on `projectKey` for `provider`: {kind: 'setting', key, value} on SonarQube Cloud, else
 * {kind: 'period', form: {project, type, value?}} for api/new_code_periods/set.
 */
export function newCodeWrite(provider, projectKey, period) {
  if (provider === 'sonar-cloud') return { kind: 'setting', key: CLOUD_NEW_CODE_SETTING, value: cloudLeakValue(period) };
  return { kind: 'period', form: { project: projectKey, type: period.type, ...(period.value === undefined ? {} : { value: String(period.value) }) } };
}

/**
 * Whether a provider's readback holds `period`: on SonarQube Cloud the api/settings/values answer ({settings: [{key, value}]}),
 * elsewhere the api/new_code_periods/show answer ({type, value}). A missing definition, another type or another value is no match.
 */
export function newCodeMatches(provider, readback, period) {
  if (provider === 'sonar-cloud') {
    const row = (readback?.settings ?? []).find((setting) => setting?.key === CLOUD_NEW_CODE_SETTING);
    return row?.value === cloudLeakValue(period);
  }
  if (readback?.type !== period.type) return false;
  return period.value === undefined || String(readback.value) === String(period.value);
}

/** The public proof of an ensured period: `NUMBER_OF_DAYS:30` or `PREVIOUS_VERSION`. */
export const newCodeProof = (period) => (period.value === undefined ? period.type : `${period.type}:${period.value}`);

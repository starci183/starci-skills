// param-names.mjs - the one shape of `ruleParams.be.paramNames` of knowledge/hfs/slots.yaml (R85 injected-param-name): a non-empty list of unique
// entries `{type | typeSuffix, names, nameSuffix?}`. The loader of scripts/hfs/slots.mjs calls it; the schema (modules/schemas/hfs-slots.schema.yaml)
// states the same shape and tests/hfs/hfs-slots.spec.mjs proves the two agree.
import { isPlainObject } from '../../engine/plain-object.mjs';

const UPPER = /^[A-Z][A-Za-z0-9]*$/u;
const LOWER = /^[a-z][A-Za-z0-9]*$/u;

const entryOk = (e) => isPlainObject(e) && ((e.type === undefined) !== (e.typeSuffix === undefined)) && UPPER.test(String(e.type ?? e.typeSuffix))
  && Array.isArray(e.names) && e.names.length > 0 && new Set(e.names).size === e.names.length && e.names.every((n) => LOWER.test(String(n)))
  && (e.nameSuffix === undefined || UPPER.test(String(e.nameSuffix))) && Object.keys(e).every((k) => ['type', 'typeSuffix', 'names', 'nameSuffix'].includes(k));

/** True when `list` is a well-formed paramNames table. */
export function paramNamesOk(list) {
  if (!Array.isArray(list) || list.length === 0 || !list.every(entryOk)) return false;
  const keys = list.map((e) => (e.type !== undefined ? `type:${e.type}` : `typeSuffix:${e.typeSuffix}`));
  return new Set(keys).size === keys.length;
}

// json-schema.mjs - a minimal draft-2020-12 JSON schema walker over the keywords the runtime's yaml schemas use.
import {isPlainObject} from '../../engine/plain-object.mjs';

// A minimal draft-2020-12 walker over the keywords op.schema.yaml uses. ajv is
// a devDependency; the runtime has no npm dependencies, so the walker is here.
/** Validate the supported schema keywords, including exact-one and at-least-one alternatives, without mutating input. */
export function validateAgainstSchema(value, schema) {
  const errors = [];
  const resolve = (ref) => String(ref).replace(/^#\//, '').split('/')
    .reduce((node, key) => node?.[key.replaceAll('~1', '/').replaceAll('~0', '~')], schema);
  const typeOk = (node, type) => {
    if (Array.isArray(type)) return type.some((t) => typeOk(node, t));
    if (type === 'object') return isPlainObject(node);
    if (type === 'array') return Array.isArray(node);
    if (type === 'integer') return Number.isInteger(node);
    if (type === 'null') return node === null;
    return typeof node === type;
  };
  const validateType = (node, shape, at) => {
    if (shape.type !== undefined && !typeOk(node, shape.type)) {
      errors.push(`${at}: expected ${Array.isArray(shape.type) ? shape.type.join('|') : shape.type}`);
      return false;
    }
    return true;
  };
  const validateString = (node, shape, at) => {
    if (shape.minLength !== undefined && node.length < shape.minLength) errors.push(`${at}: empty or too short`);
    if (shape.pattern && !new RegExp(shape.pattern, 'u').test(node)) errors.push(`${at}: ${JSON.stringify(node)} does not match ${shape.pattern}`);
  };
  const validateNumber = (node, shape, at) => {
    if (shape.minimum !== undefined && node < shape.minimum) errors.push(`${at}: below minimum ${shape.minimum}`);
    if (shape.maximum !== undefined && node > shape.maximum) errors.push(`${at}: above maximum ${shape.maximum}`);
  };
  const validateScalar = (node, shape, at) => {
    if (Object.hasOwn(shape, 'const') && node !== shape.const) errors.push(`${at}: must be ${JSON.stringify(shape.const)}`);
    if (Array.isArray(shape.enum) && !shape.enum.includes(node)) errors.push(`${at}: ${JSON.stringify(node)} is outside [${shape.enum.join(', ')}]`);
    if (typeof node === 'string') validateString(node, shape, at);
    if (typeof node === 'number') validateNumber(node, shape, at);
  };
  const validateArray = (node, shape, at, walk) => {
    if (shape.minItems !== undefined && node.length < shape.minItems) errors.push(`${at}: needs at least ${shape.minItems} item(s)`);
    if (shape.items) node.forEach((item, i) => walk(item, shape.items, `${at}[${i}]`));
  };
  const validateObject = (node, shape, at, walk) => {
    if (shape.minProperties !== undefined && Object.keys(node).length < shape.minProperties) errors.push(`${at}: needs at least ${shape.minProperties} entr(y|ies)`);
    for (const key of shape.required ?? []) if (!Object.hasOwn(node, key)) errors.push(`${at}: missing ${key}`);
    for (const [key, child] of Object.entries(node)) {
      const where = at === '$' ? `$.${key}` : `${at}.${key}`;
      if (Object.hasOwn(shape.properties ?? {}, key)) walk(child, shape.properties[key], where);
      else if (shape.additionalProperties === false) errors.push(`${where}: unknown key`);
      else if (isPlainObject(shape.additionalProperties)) walk(child, shape.additionalProperties, where);
    }
  };
  const validateAlternatives = (node, shape, at, walk) => {
    for (const keyword of ['anyOf', 'oneOf']) {
      if (!Object.hasOwn(shape, keyword)) continue;
      const branches = shape[keyword];
      if (!Array.isArray(branches) || branches.length === 0) { errors.push(`${at}: ${keyword} needs a nonempty schema list`); continue; }
      const outcomes = branches.map((branch) => {
        const start = errors.length;
        walk(node, branch, at);
        return errors.splice(start);
      });
      const matched = outcomes.filter((findings) => findings.length === 0).length;
      if (keyword === 'oneOf' && matched > 1) errors.push(`${at}: oneOf matches more than one alternative`);
      else if (matched === 0) {
        errors.push(`${at}: ${keyword} matches no alternative`);
        // The nearest branch explains a refusal without mixing findings from mutually exclusive shapes.
        const nearest = outcomes.reduce((best, findings) => findings.length < best.length ? findings : best, outcomes[0]);
        errors.push(...nearest);
      }
    }
  };
  const walk = (node, shape, at) => {
    if (shape === true) return;
    if (shape === false) { errors.push(`${at}: schema refuses this value`); return; }
    if (!isPlainObject(shape)) { errors.push(`${at}: schema is invalid`); return; }
    if (shape.$ref) {
      const referenced = String(shape.$ref).startsWith('#/') ? resolve(shape.$ref) : undefined;
      if (referenced === undefined) { errors.push(`${at}: schema reference is unresolved`); return; }
      walk(node, referenced, at);
      return;
    }
    validateAlternatives(node, shape, at, walk);
    if (!validateType(node, shape, at)) return;
    validateScalar(node, shape, at);
    if (Array.isArray(node)) {
      validateArray(node, shape, at, walk);
      return;
    }
    if (!isPlainObject(node)) return;
    validateObject(node, shape, at, walk);
  };
  walk(value, schema, '$');
  return errors;
}

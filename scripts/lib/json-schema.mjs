// json-schema.mjs - a minimal draft-2020-12 JSON schema walker over the keywords the runtime's yaml schemas use.
import {isPlainObject} from '../../engine/plain-object.mjs';

// A minimal draft-2020-12 walker over the keywords op.schema.yaml uses. ajv is
// a devDependency; the runtime has no npm dependencies, so the walker is here.
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
  const walk = (node, shape, at) => {
    if (!isPlainObject(shape)) return;
    if (shape.$ref) { walk(node, resolve(shape.$ref), at); return; }
    if (shape.type !== undefined && !typeOk(node, shape.type)) {
      errors.push(`${at}: expected ${Array.isArray(shape.type) ? shape.type.join('|') : shape.type}`);
      return;
    }
    if (Object.hasOwn(shape, 'const') && node !== shape.const) errors.push(`${at}: must be ${JSON.stringify(shape.const)}`);
    if (Array.isArray(shape.enum) && !shape.enum.includes(node)) errors.push(`${at}: ${JSON.stringify(node)} is outside [${shape.enum.join(', ')}]`);
    if (typeof node === 'string') {
      if (shape.minLength !== undefined && node.length < shape.minLength) errors.push(`${at}: empty or too short`);
      if (shape.pattern && !new RegExp(shape.pattern, 'u').test(node)) errors.push(`${at}: ${JSON.stringify(node)} does not match ${shape.pattern}`);
    }
    if (typeof node === 'number') {
      if (shape.minimum !== undefined && node < shape.minimum) errors.push(`${at}: below minimum ${shape.minimum}`);
      if (shape.maximum !== undefined && node > shape.maximum) errors.push(`${at}: above maximum ${shape.maximum}`);
    }
    if (Array.isArray(node)) {
      if (shape.minItems !== undefined && node.length < shape.minItems) errors.push(`${at}: needs at least ${shape.minItems} item(s)`);
      if (shape.items) node.forEach((item, i) => walk(item, shape.items, `${at}[${i}]`));
      return;
    }
    if (!isPlainObject(node)) return;
    if (shape.minProperties !== undefined && Object.keys(node).length < shape.minProperties) errors.push(`${at}: needs at least ${shape.minProperties} entr(y|ies)`);
    for (const key of shape.required ?? []) if (!Object.hasOwn(node, key)) errors.push(`${at}: missing ${key}`);
    for (const [key, child] of Object.entries(node)) {
      const where = at === '$' ? `$.${key}` : `${at}.${key}`;
      if (Object.hasOwn(shape.properties ?? {}, key)) walk(child, shape.properties[key], where);
      else if (shape.additionalProperties === false) errors.push(`${where}: unknown key`);
      else if (isPlainObject(shape.additionalProperties)) walk(child, shape.additionalProperties, where);
    }
  };
  walk(value, schema, '$');
  return errors;
}

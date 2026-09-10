/** Minimal draft-2020-12 subset used by knowledge YAML compile (no Ajv dependency). */
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);

export function canonicalJSON(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJSON).join(',')}]`;
  if (object(value)) return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonicalJSON(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}

function resolveRef(root, ref) {
  if (!ref.startsWith('#/')) throw Error(`Unsupported schema $ref ${ref}`);
  return ref.slice(2).split('/').reduce((node, key) => {
    const part = key.replaceAll('~1', '/').replaceAll('~0', '~');
    if (!object(node) || !Object.hasOwn(node, part)) throw Error(`Unresolved schema $ref ${ref}`);
    return node[part];
  }, root);
}

function matchesType(value, type) {
  if (type === 'object') return object(value);
  if (type === 'array') return Array.isArray(value);
  if (type === 'integer') return Number.isInteger(value);
  if (type === 'null') return value === null;
  return typeof value === type;
}

/**
 * Validate `value` against a JSON Schema document.
 * `registry` maps absolute `$id` strings to schema roots for cross-file `$ref`.
 */
export function validateAgainstSchema(value, schema, { path = '$', registry = new Map() } = {}) {
  const errors = [];
  const issue = (p, message) => errors.push({ path: p, message });

  function check(node, shape, p, sink = issue) {
    if (!shape || typeof shape !== 'object') return;
    if (shape.$ref) {
      let target;
      if (shape.$ref.startsWith('#/')) target = resolveRef(schema, shape.$ref);
      else if (registry.has(shape.$ref)) target = registry.get(shape.$ref);
      else {
        sink(p, `Unresolved schema $ref ${shape.$ref}`);
        return;
      }
      check(node, target, p, sink);
      return;
    }
    if (Array.isArray(shape.anyOf)) {
      const ok = shape.anyOf.some(option => {
        const local = [];
        check(node, option, p, (pathValue, message) => local.push({ path: pathValue, message }));
        return local.length === 0;
      });
      if (!ok) sink(p, 'Value matches no anyOf option');
    }
    if (Array.isArray(shape.oneOf)) {
      let matches = 0;
      for (const option of shape.oneOf) {
        const local = [];
        check(node, option, p, (pathValue, message) => local.push({ path: pathValue, message }));
        if (local.length === 0) matches += 1;
      }
      if (matches !== 1) sink(p, `Value must match exactly one oneOf option (matched ${matches})`);
      // oneOf shapes are usually alternatives for the whole value; skip sibling keywords when used alone
      if (!shape.type && !shape.properties && !shape.required) return;
    }
    if (shape.type && !matchesType(node, shape.type)) {
      sink(p, `Expected type ${shape.type}`);
      return;
    }
    if (Object.hasOwn(shape, 'const') && canonicalJSON(node) !== canonicalJSON(shape.const)) {
      sink(p, 'Value does not match required const');
    }
    if (Array.isArray(shape.enum) && !shape.enum.some(item => canonicalJSON(item) === canonicalJSON(node))) {
      sink(p, 'Value is outside enum');
    }
    if (typeof node === 'string') {
      if (Number.isInteger(shape.minLength) && node.length < shape.minLength) sink(p, `String shorter than minLength ${shape.minLength}`);
      if (shape.pattern && !new RegExp(shape.pattern, 'u').test(node)) sink(p, 'String does not match pattern');
    }
    if (typeof node === 'number' && Number.isFinite(shape.minimum) && node < shape.minimum) {
      sink(p, `Number below minimum ${shape.minimum}`);
    }
    if (Array.isArray(node)) {
      if (Number.isInteger(shape.minItems) && node.length < shape.minItems) sink(p, `Array shorter than minItems ${shape.minItems}`);
      if (shape.uniqueItems && new Set(node.map(canonicalJSON)).size !== node.length) sink(p, 'Array items must be unique');
      if (shape.items) node.forEach((item, index) => check(item, shape.items, `${p}/${index}`, sink));
      return;
    }
    if (!object(node)) return;
    for (const key of shape.required ?? []) {
      if (!Object.hasOwn(node, key)) sink(p, `Missing required field ${key}`);
    }
    for (const [key, child] of Object.entries(node)) {
      if (shape.additionalProperties === false && !Object.hasOwn(shape.properties ?? {}, key)) {
        sink(p, `Unknown field ${key}`);
      } else if (Object.hasOwn(shape.properties ?? {}, key)) {
        check(child, shape.properties[key], `${p}/${key}`, sink);
      }
    }
  }

  check(value, schema, path);
  return { ok: errors.length === 0, errors };
}

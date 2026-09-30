/**
 * JSON Schema (2020-12, the dialect of OpenAPI 3.1) of a TypeScript type, read from the type checker.
 *
 * Deterministic: properties, enum members and union members are sorted; object types with a name become components (`$ref`) once,
 * in the order they are met. Undecidable types are errors naming the path inside the type, never `{}`: `any`, `unknown`, `never`,
 * `object`, an unbound generic, a function, a class of the standard library (Date, Map, Set, Promise), a bigint, a symbol, an
 * object type with no members and no index signature, and a union with `undefined` where a member could not simply be absent.
 * Pure: takes the TypeScript module and a checker.
 */

/** Sorts object keys at every depth, so equal schemas print equal text. */
export function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  return value;
}

const canonical = (value) => JSON.stringify(stable(value));

/** A builder over one checker; `components` fills as named object types are met. */
export function createSchemaBuilder({ ts, checker }) {
  const F = ts.TypeFlags;
  const components = new Map();
  const nameOf = new Map();
  const taken = new Set();
  const fail = (path, why) => {
    throw new Error(`${path}: ${why}`);
  };

  const isLibrary = (symbol) => (symbol?.getDeclarations?.() ?? []).some((declaration) => /[\\/]typescript[\\/]lib[\\/]lib\./.test(declaration.getSourceFile().fileName));

  const componentName = (type) => {
    const symbol = type.aliasSymbol ?? type.getSymbol();
    const written = checker.typeToString(type, undefined, ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope);
    const base = (symbol && !/^__/.test(symbol.getName()) && !isLibrary(symbol) ? written : null);
    if (!base) return null;
    const clean = base.replace(/[^A-Za-z0-9._-]+/g, '.').replace(/^\.+|\.+$/g, '');
    let name = clean;
    for (let n = 2; taken.has(name); n += 1) name = `${clean}_${n}`;
    taken.add(name);
    return name;
  };

  const withoutUndefined = (type) => (type.isUnion() ? type.types.filter((member) => !(member.flags & (F.Undefined | F.Void))) : [type]);

  /** The schema of a set of union members (no `undefined` among them). */
  function membersSchema(members, path) {
    const hasTrue = members.some((member) => member.flags & F.BooleanLiteral && checker.typeToString(member) === 'true');
    const hasFalse = members.some((member) => member.flags & F.BooleanLiteral && checker.typeToString(member) === 'false');
    const parts = [];
    let rest = members;
    if (hasTrue && hasFalse) {
      rest = members.filter((member) => !(member.flags & F.BooleanLiteral));
      parts.push({ type: 'boolean' });
    }
    const consts = [];
    for (const member of rest) {
      if (member.flags & (F.StringLiteral | F.NumberLiteral)) consts.push(member.value);
      else if (member.flags & F.BooleanLiteral) consts.push(checker.typeToString(member) === 'true');
      else parts.push(schemaOf(member, path));
    }
    if (consts.length) {
      const sorted = [...consts].sort((a, b) => (String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0));
      const kinds = new Set(sorted.map((item) => typeof item));
      parts.push(kinds.size === 1 && !kinds.has('boolean') ? { enum: sorted, type: kinds.has('string') ? 'string' : 'number' } : { enum: sorted });
    }
    const unique = [...new Map(parts.map((part) => [canonical(part), part])).values()].sort((a, b) => (canonical(a) < canonical(b) ? -1 : 1));
    return unique.length === 1 ? unique[0] : { anyOf: unique };
  }

  function unionSchema(type, path) {
    if (type.types.some((member) => member.flags & (F.Undefined | F.Void))) fail(path, 'undefined is not a wire value here (declare the member optional instead)');
    return membersSchema(type.types, path);
  }

  function objectSchema(type, path) {
    if (checker.isArrayType(type) || checker.isTupleType(type)) {
      if (checker.isTupleType(type)) {
        const items = checker.getTypeArguments(type).map((item, index) => schemaOf(item, `${path}[${index}]`));
        return { type: 'array', prefixItems: items, minItems: items.length, maxItems: items.length };
      }
      return { type: 'array', items: schemaOf(checker.getTypeArguments(type)[0], `${path}[]`) };
    }
    if (type.getCallSignatures().length || type.getConstructSignatures().length) fail(path, 'a function is not a wire value');
    const own = type.getSymbol();
    if (own && !own.getName().startsWith('__') && isLibrary(own) && !/^(Readonly)?Array$/.test(own.getName())) fail(path, `${own.getName()} is not a JSON value (send a string or a plain object type)`);
    const existing = nameOf.get(type);
    if (existing) return { $ref: `#/components/schemas/${existing}` };
    const name = componentName(type);
    if (name) {
      nameOf.set(type, name);
      components.set(name, null);
    }
    const built = plainObject(type, path);
    if (!name) return built;
    components.set(name, built);
    return { $ref: `#/components/schemas/${name}` };
  }

  function plainObject(type, path) {
    const properties = {};
    const required = [];
    const props = [...checker.getPropertiesOfType(type)].sort((a, b) => (a.getName() < b.getName() ? -1 : 1));
    for (const prop of props) {
      const propType = checker.getTypeOfSymbol(prop);
      const optional = (prop.flags & ts.SymbolFlags.Optional) !== 0;
      const members = propType.isUnion() ? propType.types : [propType];
      const kept = withoutUndefined(propType);
      if (kept.length === 0) fail(`${path}.${prop.getName()}`, 'undefined is not a wire value');
      const hadUndefined = kept.length < members.length;
      properties[prop.getName()] = !hadUndefined ? schemaOf(propType, `${path}.${prop.getName()}`) : kept.length === 1 ? schemaOf(kept[0], `${path}.${prop.getName()}`) : membersSchema(kept, `${path}.${prop.getName()}`);
      if (!optional && !hadUndefined) required.push(prop.getName());
    }
    const index = checker.getIndexInfosOfType(type).find((info) => info.keyType.flags & F.String);
    if (props.length === 0 && !index) fail(path, 'an object type with no members and no index signature says nothing');
    const result = { type: 'object' };
    if (props.length) result.properties = properties;
    if (required.length) result.required = required;
    if (index) result.additionalProperties = schemaOf(index.type, `${path}[key]`);
    return result;
  }

  function schemaOf(type, path) {
    const f = type.flags;
    if (f & F.Any) fail(path, 'any');
    if (f & F.Unknown) fail(path, 'unknown');
    if (f & F.Never) fail(path, 'never');
    if (f & (F.Undefined | F.Void)) fail(path, 'undefined is not a wire value');
    if (f & F.TypeParameter) fail(path, 'an unbound generic');
    if (f & F.NonPrimitive) fail(path, 'object with no declared members');
    if (f & (F.BigInt | F.BigIntLiteral | F.ESSymbol | F.UniqueESSymbol)) fail(path, 'bigint and symbol are not JSON values');
    if (f & F.StringLiteral) return { const: type.value };
    if (f & F.NumberLiteral) return { const: type.value };
    if (f & F.BooleanLiteral) return { const: checker.typeToString(type) === 'true' };
    if (f & F.String) return { type: 'string' };
    if (f & F.Number) return { type: 'number' };
    if (f & F.Boolean) return { type: 'boolean' };
    if (f & F.Null) return { type: 'null' };
    if (type.isUnion()) return unionSchema(type, path);
    if (f & F.Object || f & F.Intersection) return objectSchema(type, path);
    return fail(path, `a type this reader cannot express (${checker.typeToString(type)})`);
  }

  return { schemaOf, components: () => Object.fromEntries([...components.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) };
}

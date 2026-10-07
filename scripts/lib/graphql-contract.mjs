// graphql-contract.mjs - the GraphQL a back-end contract snapshot holds and the checks a front-end document must pass
// against it. It reads the SDL `starci app emit` writes (`be/contracts/<service>/schema.graphql`: object, input, enum,
// scalar, interface and union types, descriptions and directives) and the executable documents a front end keeps in
// `.graphql` files (operations with variables, field arguments, object literals, inline fragments), with no dependency:
// the runtime ships no GraphQL library, and an app's own install is not always resolvable from where hfs runs.
//
// What a document is checked for: every selected field exists on its parent type, every argument it passes is declared
// and every required argument (or required input field of an object literal) is given, an object literal names only
// declared input fields, a variable passed to an argument has the argument's named type, a leaf field selects nothing
// and an object field selects something, and every declared variable is used. Validation stops at the first failure of
// each field path, so a broken document reads as a short list of named problems.

const PUNCTUATORS = new Set(['{', '}', '(', ')', '[', ']', ':', '!', '=', '$', '@', '|', '&']);
const BUILT_IN_SCALARS = new Set(['String', 'Int', 'Float', 'Boolean', 'ID']);

/** The tokens of a GraphQL source: names, punctuators, `...`, strings and numbers; comments and commas are insignificant. */
export function tokenize(source) {
  const tokens = [];
  let index = 0;
  while (index < source.length) {
    const char = source[index];
    if (char === '#') {
      while (index < source.length && source[index] !== '\n') index += 1;
    } else if (/[\s,﻿]/.test(char)) {
      index += 1;
    } else if (source.startsWith('...', index)) {
      tokens.push({ kind: 'spread', value: '...' });
      index += 3;
    } else if (source.startsWith('"""', index)) {
      const end = source.indexOf('"""', index + 3);
      if (end === -1) throw new SyntaxError('unterminated block string');
      tokens.push({ kind: 'string', value: source.slice(index + 3, end) });
      index = end + 3;
    } else if (char === '"') {
      let end = index + 1;
      while (end < source.length && source[end] !== '"') end += source[end] === '\\' ? 2 : 1;
      tokens.push({ kind: 'string', value: source.slice(index + 1, end) });
      index = end + 1;
    } else if (PUNCTUATORS.has(char)) {
      tokens.push({ kind: 'punct', value: char });
      index += 1;
    } else if (/[_A-Za-z]/.test(char)) {
      const match = /^[_A-Za-z]\w*/.exec(source.slice(index));
      tokens.push({ kind: 'name', value: match[0] });
      index += match[0].length;
    } else if (/[-0-9]/.test(char)) {
      const match = /^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(source.slice(index));
      if (!match) throw new SyntaxError(`unexpected character "${char}"`);
      tokens.push({ kind: 'number', value: match[0] });
      index += match[0].length;
    } else {
      throw new SyntaxError(`unexpected character "${char}"`);
    }
  }
  return tokens;
}

/** A cursor over tokens with the expectations both parsers share. */
function cursorOf(tokens) {
  let index = 0;
  const cursor = {
    peek: (offset = 0) => tokens[index + offset] ?? null,
    next: () => {
      const token = tokens[index];
      if (token === undefined) throw new SyntaxError('unexpected end of document');
      index += 1;
      return token;
    },
    is: (value) => tokens[index]?.value === value && tokens[index]?.kind !== 'string',
    done: () => index >= tokens.length,
    take: (value) => {
      if (!cursor.is(value)) return false;
      index += 1;
      return true;
    },
    expect: (value) => {
      const token = cursor.next();
      if (token.value !== value || token.kind === 'string') throw new SyntaxError(`expected "${value}", found "${token.value}"`);
      return token;
    },
    name: () => {
      const token = cursor.next();
      if (token.kind !== 'name') throw new SyntaxError(`expected a name, found "${token.value}"`);
      return token.value;
    },
  };
  return cursor;
}

/** A type reference: `{ name, list, nonNull, item }`. */
function parseTypeRef(cursor) {
  let type;
  if (cursor.take('[')) {
    const item = parseTypeRef(cursor);
    cursor.expect(']');
    type = { list: true, item, name: item.name, nonNull: false };
  } else {
    type = { list: false, name: cursor.name(), nonNull: false };
  }
  if (cursor.take('!')) type = { ...type, nonNull: true };
  return type;
}

/** Skips one value of any shape (a default value, a directive argument). */
function skipValue(cursor) {
  const token = cursor.next();
  if (token.kind !== 'punct') return;
  if (token.value === '$') return void cursor.name();
  let close = null;
  if (token.value === '{') close = '}';
  else if (token.value === '[') close = ']';
  if (close === null) return;
  while (!cursor.take(close)) {
    if (token.value === '{') {
      cursor.name();
      cursor.expect(':');
    }
    skipValue(cursor);
  }
}

function skipDirectives(cursor) {
  while (cursor.take('@')) {
    cursor.name();
    if (cursor.take('(')) {
      while (!cursor.take(')')) {
        cursor.name();
        cursor.expect(':');
        skipValue(cursor);
      }
    }
  }
}

function skipDescription(cursor) {
  if (cursor.peek()?.kind === 'string') cursor.next();
}

/** Field or input-value definitions between braces. */
function parseFieldDefinitions(cursor, withArguments) {
  const fields = new Map();
  cursor.expect('{');
  while (!cursor.take('}')) {
    skipDescription(cursor);
    const name = cursor.name();
    const args = new Map();
    if (withArguments && cursor.take('(')) {
      while (!cursor.take(')')) {
        skipDescription(cursor);
        const argName = cursor.name();
        cursor.expect(':');
        const type = parseTypeRef(cursor);
        const hasDefault = cursor.take('=');
        if (hasDefault) skipValue(cursor);
        skipDirectives(cursor);
        args.set(argName, { type, hasDefault });
      }
    }
    cursor.expect(':');
    const type = parseTypeRef(cursor);
    const hasDefault = cursor.take('=');
    if (hasDefault) skipValue(cursor);
    skipDirectives(cursor);
    fields.set(name, { type, args, hasDefault });
  }
  return fields;
}

/** The types of an SDL source: Map(name -> { kind, fields? , values? , members? }), plus the root operation type names. */
export function parseSchema(source) {
  const cursor = cursorOf(tokenize(source));
  const types = new Map();
  const roots = { query: 'Query', mutation: 'Mutation', subscription: 'Subscription' };
  while (!cursor.done()) {
    skipDescription(cursor);
    const keyword = cursor.name();
    if (keyword === 'schema' || (keyword === 'extend' && cursor.is('schema'))) {
      if (keyword === 'extend') cursor.name();
      skipDirectives(cursor);
      cursor.expect('{');
      while (!cursor.take('}')) {
        const operation = cursor.name();
        cursor.expect(':');
        roots[operation] = cursor.name();
      }
    } else if (keyword === 'directive') {
      cursor.expect('@');
      cursor.name();
      if (cursor.take('(')) parseArgumentList(cursor);
      if (cursor.is('repeatable')) cursor.name();
      cursor.name();
      cursor.take('|');
      cursor.name();
      while (cursor.take('|')) cursor.name();
    } else if (keyword === 'scalar') {
      const name = cursor.name();
      skipDirectives(cursor);
      types.set(name, { kind: 'scalar' });
    } else if (keyword === 'enum') {
      const name = cursor.name();
      skipDirectives(cursor);
      const values = new Set();
      cursor.expect('{');
      while (!cursor.take('}')) {
        skipDescription(cursor);
        values.add(cursor.name());
        skipDirectives(cursor);
      }
      types.set(name, { kind: 'enum', values });
    } else if (keyword === 'union') {
      const name = cursor.name();
      skipDirectives(cursor);
      cursor.expect('=');
      cursor.take('|');
      const members = [cursor.name()];
      while (cursor.take('|')) members.push(cursor.name());
      types.set(name, { kind: 'union', members });
    } else if (keyword === 'type' || keyword === 'interface' || keyword === 'input') {
      const name = cursor.name();
      if (cursor.is('implements')) {
        cursor.name();
        cursor.take('&');
        cursor.name();
        while (cursor.take('&')) cursor.name();
      }
      skipDirectives(cursor);
      let kind = 'object';
      if (keyword === 'input') kind = 'input';
      else if (keyword === 'interface') kind = 'interface';
      types.set(name, { kind, fields: parseFieldDefinitions(cursor, kind !== 'input') });
    } else {
      throw new SyntaxError(`unexpected "${keyword}" in a schema`);
    }
  }
  return { types, roots };
}

function parseArgumentList(cursor) {
  while (!cursor.take(')')) {
    skipDescription(cursor);
    cursor.name();
    cursor.expect(':');
    parseTypeRef(cursor);
    if (cursor.take('=')) skipValue(cursor);
    skipDirectives(cursor);
  }
}

/** A value of a document: `{ kind: 'variable', name }`, `{ kind: 'object', fields: Map }`, `{ kind: 'list', items }` or a scalar. */
function parseValue(cursor) {
  if (cursor.take('$')) return { kind: 'variable', name: cursor.name() };
  if (cursor.take('{')) {
    const fields = new Map();
    while (!cursor.take('}')) {
      const name = cursor.name();
      cursor.expect(':');
      fields.set(name, parseValue(cursor));
    }
    return { kind: 'object', fields };
  }
  if (cursor.take('[')) {
    const items = [];
    while (!cursor.take(']')) items.push(parseValue(cursor));
    return { kind: 'list', items };
  }
  const token = cursor.next();
  return { kind: token.kind === 'name' ? 'literal-name' : 'literal', value: token.value };
}

/** A selection set: [{ kind: 'field', name, alias, args: Map, selections } | { kind: 'inline', on, selections } | { kind: 'spread', name }]. */
function parseSelectionSet(cursor) {
  const selections = [];
  cursor.expect('{');
  while (!cursor.take('}')) {
    if (cursor.peek()?.kind === 'spread') {
      cursor.next();
      if (cursor.is('on')) {
        cursor.name();
        const on = cursor.name();
        skipDirectives(cursor);
        selections.push({ kind: 'inline', on, selections: parseSelectionSet(cursor) });
      } else if (cursor.is('{') || cursor.is('@')) {
        skipDirectives(cursor);
        selections.push({ kind: 'inline', on: null, selections: parseSelectionSet(cursor) });
      } else {
        selections.push({ kind: 'spread', name: cursor.name() });
        skipDirectives(cursor);
      }
      continue;
    }
    let name = cursor.name();
    let alias = null;
    if (cursor.take(':')) {
      alias = name;
      name = cursor.name();
    }
    const args = new Map();
    if (cursor.take('(')) {
      while (!cursor.take(')')) {
        const argName = cursor.name();
        cursor.expect(':');
        args.set(argName, parseValue(cursor));
      }
    }
    skipDirectives(cursor);
    const subSelections = cursor.is('{') ? parseSelectionSet(cursor) : null;
    selections.push({ kind: 'field', name, alias, args, selections: subSelections });
  }
  return selections;
}

/** The operations and fragments of an executable document. */
export function parseDocument(source) {
  const cursor = cursorOf(tokenize(source));
  const operations = [];
  const fragments = new Map();
  while (!cursor.done()) {
    if (cursor.is('{')) {
      operations.push({ operation: 'query', name: null, variables: new Map(), selections: parseSelectionSet(cursor) });
      continue;
    }
    const keyword = cursor.name();
    if (keyword === 'fragment') {
      const name = cursor.name();
      if (!cursor.take('on')) throw new SyntaxError(`fragment ${name} names no type condition`);
      const on = cursor.name();
      skipDirectives(cursor);
      fragments.set(name, { on, selections: parseSelectionSet(cursor) });
      continue;
    }
    if (keyword !== 'query' && keyword !== 'mutation' && keyword !== 'subscription') throw new SyntaxError(`unexpected "${keyword}" in a document`);
    const name = cursor.peek()?.kind === 'name' ? cursor.name() : null;
    const variables = new Map();
    if (cursor.take('(')) {
      while (!cursor.take(')')) {
        cursor.expect('$');
        const variable = cursor.name();
        cursor.expect(':');
        const type = parseTypeRef(cursor);
        if (cursor.take('=')) skipValue(cursor);
        skipDirectives(cursor);
        variables.set(variable, type);
      }
    }
    skipDirectives(cursor);
    operations.push({ operation: keyword, name, variables, selections: parseSelectionSet(cursor) });
  }
  return { operations, fragments };
}

const typeText = (type) => (type.list ? `[${typeText(type.item)}]` : type.name) + (type.nonNull ? '!' : '');

function variableProblems(value, type, where, operation, used) {
  if (value.kind === 'variable') {
    used.add(value.name);
    const declared = operation.variables.get(value.name);
    if (declared === undefined) return [`${where} uses $${value.name}, which the operation does not declare`];
    return declared.name === type.name ? [] : [`${where} takes ${typeText(type)}, but $${value.name} is ${typeText(declared)}`];
  }
  return null;
}

function objectValueProblems(schema, value, type, where, operation, used, named) {
  if (named?.kind !== 'input') return [`${where} is an object, but ${type.name} is not an input type`];
  const problems = [];
  for (const [field, inner] of value.fields) {
    const declared = named.fields.get(field);
    if (declared === undefined) problems.push(`${where} names ${field}, which the input ${type.name} does not declare (it declares ${[...named.fields.keys()].join(', ') || 'nothing'})`);
    else problems.push(...valueProblems(schema, inner, declared.type, `${where}.${field}`, operation, used));
  }
  for (const [field, declared] of named.fields) {
    if (declared.type.nonNull && !declared.hasDefault && !value.fields.has(field)) problems.push(`${where} omits ${field}, which the input ${type.name} requires`);
  }
  return problems;
}

/** The problems of one value against the input type it is passed as. */
function valueProblems(schema, value, type, where, operation, used) {
  const variable = variableProblems(value, type, where, operation, used);
  if (variable !== null) return variable;
  if (type.list && value.kind === 'list') return value.items.flatMap((item, i) => valueProblems(schema, item, type.item, `${where}[${i}]`, operation, used));
  const named = schema.types.get(type.name);
  if (value.kind === 'object') return objectValueProblems(schema, value, type, where, operation, used, named);
  return [];
}

function fragmentSelectionProblems(context, selection) {
  const { schema, document, parentName, path, operation, used, visiting } = context;
  const fragment = document.fragments.get(selection.name);
  if (fragment === undefined) return [`${path} spreads ...${selection.name}, which the document does not define`];
  if (visiting.has(selection.name)) return [];
  return selectionProblems({ schema, document, parentName: fragment.on, selections: fragment.selections, path, operation, used, visiting: new Set([...visiting, selection.name]) });
}

function inlineSelectionProblems(context, selection) {
  const { schema, document, parentName, path, operation, used, visiting } = context;
  return selectionProblems({ schema, document, parentName: selection.on ?? parentName, selections: selection.selections, path, operation, used, visiting });
}

function fieldArgumentProblems({ schema, parentName, operation, used }, selection, where, field) {
  const problems = [];
  for (const [arg, value] of selection.args) {
    const declared = field.args.get(arg);
    if (declared === undefined) problems.push(`${where} passes ${arg}, which ${parentName}.${selection.name} does not take (it takes ${[...field.args.keys()].join(', ') || 'no argument'})`);
    else problems.push(...valueProblems(schema, value, declared.type, `${where}(${arg})`, operation, used));
  }
  return problems;
}

function requiredFieldArgumentProblems(parentName, selection, where, field) {
  const problems = [];
  for (const [arg, declared] of field.args) {
    if (declared.type.nonNull && !declared.hasDefault && !selection.args.has(arg)) problems.push(`${where} omits ${arg}, which ${parentName}.${selection.name} requires`);
  }
  return problems;
}

function fieldSelectionShapeProblems(context, selection, where, field) {
  const { schema, document, operation, used, visiting } = context;
  const target = schema.types.get(field.type.name);
  const leaf = BUILT_IN_SCALARS.has(field.type.name) || target?.kind === 'scalar' || target?.kind === 'enum';
  if (leaf && selection.selections !== null) return [`${where} is a ${field.type.name}, which selects no fields`];
  if (!leaf && selection.selections === null) return [`${where} is a ${field.type.name}, which needs a selection of its fields`];
  if (!leaf) return selectionProblems({ schema, document, parentName: field.type.name, selections: selection.selections, path: where, operation, used, visiting });
  return [];
}

function fieldSelectionProblems(context, parent, selection) {
  const { parentName } = context;
  const where = `${context.path}.${selection.name}`;
  const field = parent?.fields?.get(selection.name);
  if (field === undefined) {
    const known = parent?.fields ? [...parent.fields.keys()].join(', ') : 'nothing';
    return [`${where} is not a field of ${parentName} (it has ${known})`];
  }
  const problems = fieldArgumentProblems(context, selection, where, field);
  problems.push(...requiredFieldArgumentProblems(parentName, selection, where, field));
  problems.push(...fieldSelectionShapeProblems(context, selection, where, field));
  return problems;
}

/** The problems of one selection set against its parent type. */
function selectionProblems({ schema, document, parentName, selections, path, operation, used, visiting = new Set() }) {
  const context = { schema, document, parentName, path, operation, used, visiting };
  const parent = schema.types.get(parentName);
  const problems = [];
  for (const selection of selections) {
    if (selection.kind === 'spread') {
      problems.push(...fragmentSelectionProblems(context, selection));
      continue;
    }
    if (selection.kind === 'inline') {
      problems.push(...inlineSelectionProblems(context, selection));
      continue;
    }
    if (selection.name === '__typename') continue;
    problems.push(...fieldSelectionProblems(context, parent, selection));
  }
  return problems;
}

/** The root fields an operation selects (no aliases followed into fragments). */
export const rootFieldsOf = (operation) => operation.selections.filter((selection) => selection.kind === 'field').map((selection) => selection.name);

/** The problems of one operation of a document against one parsed schema; empty when it is valid. */
export function operationProblems(schema, document, operation) {
  const rootName = schema.roots[operation.operation];
  if (!schema.types.has(rootName)) return [`the contract has no ${operation.operation} type`];
  const used = new Set();
  const label = operation.name ?? `anonymous ${operation.operation}`;
  const problems = selectionProblems({ schema, document, parentName: rootName, selections: operation.selections, path: label, operation, used });
  for (const variable of operation.variables.keys()) {
    if (!used.has(variable)) problems.push(`${label} declares $${variable}, which no argument uses`);
  }
  return problems;
}

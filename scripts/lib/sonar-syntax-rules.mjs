// sonar-syntax-rules.mjs - the ESLint rules that keep a TypeScript app clear of the smells SonarCloud flagged in the example apps, judged on
// the syntax tree alone (no type information, no dependency). Both lint canons (@starci/eslint-canon-be and -fe) publish them from their
// bundled runtime copy under the names below, so a product inherits them and `starci app lint` refuses the finding before the scan sees it.
// Each message names the Sonar rule it stands for, and a rule judges the files the example scans judge: a unit or end-to-end spec is outside the
// scan (`sonar.exclusions`), so it is outside these rules. The rules that need the type checker (S1874, S6551, S7503) are borrowed from
// typescript-eslint by the canon factories; the one that needs a regex ambiguity analysis (S8786) runs in the runtime's own `sonar-rules` check.

const FUNCTIONS = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);
const REPEATED = Object.freeze({
  ForStatement: ['body', 'test', 'update'],
  ForInStatement: ['body'],
  ForOfStatement: ['body'],
  WhileStatement: ['body', 'test'],
  DoWhileStatement: ['body', 'test'],
});

/** The first ancestor of `node` that is `type`-matching per `test`, stopping at a function or class boundary. */
function ancestorWithin(node, test) {
  for (let child = node, parent = node.parent; parent; child = parent, parent = parent.parent) {
    if (FUNCTIONS.has(parent.type) || parent.type === 'StaticBlock') return null;
    if (test(parent, child)) return parent;
  }
  return null;
}

const repeatsChild = (loop, child) => (REPEATED[loop.type] ?? []).some((key) => loop[key] === child);

/** A loop with no condition (`for (;;)`, `while (true)`) walks pages or polls: each turn needs the one before, so it cannot be run together. */
const isEndless = (loop) => (loop.type === 'ForStatement' && loop.test === null) || (['WhileStatement', 'DoWhileStatement'].includes(loop.type) && loop.test.type === 'Literal' && loop.test.value === true);

/** S9382: an `await` inside a loop body runs one step after the other; say the sequence by name or run the independent steps together. */
const noAwaitInLoop = {
  meta: {
    type: 'suggestion',
    schema: [],
    messages: { loop: 'S9382: do not `await` inside a loop. Run independent steps together with `Promise.all`, or state the sequence by name with a helper that chains the promises (`eachInOrder` of the back end\'s `platform/primitives`).' },
  },
  create: (context) => ({
    AwaitExpression: (node) => {
      if (ancestorWithin(node, (loop, child) => repeatsChild(loop, child) && !isEndless(loop))) context.report({ node, messageId: 'loop' });
    },
  }),
};

/** S7758: `codePointAt` and `fromCodePoint` handle every code point; `charCodeAt` and `fromCharCode` stop at 16 bits. */
const preferCodePoint = {
  meta: { type: 'suggestion', schema: [], messages: { codePoint: 'S7758: use `{{ better }}` instead of `{{ worse }}`; it reads whole code points, not 16-bit halves.' } },
  create: (context) => ({
    CallExpression: (node) => {
      const callee = node.callee;
      if (callee.type !== 'MemberExpression' || callee.computed || callee.property.type !== 'Identifier') return;
      const name = callee.property.name;
      if (name === 'charCodeAt') context.report({ node, messageId: 'codePoint', data: { better: 'codePointAt', worse: 'charCodeAt' } });
      else if (name === 'fromCharCode' && callee.object.type === 'Identifier' && callee.object.name === 'String') context.report({ node, messageId: 'codePoint', data: { better: 'String.fromCodePoint', worse: 'String.fromCharCode' } });
    },
  }),
};

const BACKSLASH_PAIR = '\\\\';

/** Whether the string literal only escapes backslashes: its value is its raw text with each pair read as one. */
function onlyBackslashEscapes(node) {
  const raw = node.raw;
  if (typeof node.value !== 'string' || !raw.includes(BACKSLASH_PAIR) || raw.at(-2) === '\\') return false;
  if (node.value.includes('`') || node.value.includes('${')) return false;
  return raw.slice(1, -1).replaceAll(BACKSLASH_PAIR, '\\') === node.value;
}

const KEEPS_ITS_ESCAPES = new Set(['ImportDeclaration', 'ExportAllDeclaration', 'ExportNamedDeclaration', 'TSLiteralType', 'TSExternalModuleReference', 'JSXAttribute']);

/** A property named `matcher` is read statically by Next (a template literal there kills the build), so its text keeps the escape. */
const isMatcherValue = (node) => (node.parent?.type === 'Property' && node.parent.value === node && node.parent.key?.name === 'matcher')
  || (node.parent?.type === 'ArrayExpression' && isMatcherValue(node.parent));

/** S7780: a string whose only escapes are backslashes reads better as `String.raw`. */
const preferStringRaw = {
  meta: { type: 'suggestion', schema: [], messages: { raw: 'S7780: write this string with `String.raw` so its backslashes are not escaped.' } },
  create: (context) => ({
    Literal: (node) => {
      if (KEEPS_ITS_ESCAPES.has(node.parent?.type) || node.parent?.type === 'ExpressionStatement' || isMatcherValue(node)) return;
      if (onlyBackslashEscapes(node)) context.report({ node, messageId: 'raw' });
    },
  }),
};

/** S3358: a conditional expression inside another conditional expression is read inside out; name the inner one. */
const noNestedConditional = {
  meta: { type: 'suggestion', schema: [], messages: { nested: 'S3358: extract this nested conditional expression into its own statement or a named function.' } },
  create: (context) => ({
    ConditionalExpression: (node) => {
      if (node.parent?.type === 'ConditionalExpression') context.report({ node, messageId: 'nested' });
    },
  }),
};

/** Whether `void` is used on a call: the explicit discard of a promise that Sonar and no-floating-promises both accept. */
const discardsACall = (argument) => argument.type === 'CallExpression' || argument.type === 'AwaitExpression' || (argument.type === 'ChainExpression' && argument.expression.type === 'CallExpression');

/** S3735: `void` on anything but a call hides what the code does; `void principal` says nothing, `undefined` or no statement says it. */
const noVoidOperator = {
  meta: { type: 'suggestion', schema: [], messages: { void: 'S3735: remove this `void`; it discards a value the code never needed. Only `void call()` (an explicit discard of a promise) is kept.' } },
  create: (context) => ({
    UnaryExpression: (node) => {
      if (node.operator === 'void' && !discardsACall(node.argument)) context.report({ node, messageId: 'void' });
    },
  }),
};

/** S1128: an import no reference reads is removed. */
const noUnusedImport = {
  meta: { type: 'suggestion', schema: [], messages: { unused: 'S1128: remove the unused import of `{{ name }}`.' } },
  create: (context) => ({
    ImportDeclaration: (node) => {
      for (const variable of context.sourceCode.getDeclaredVariables(node)) {
        if (variable.references.length === 0) context.report({ node: variable.identifiers[0] ?? node, messageId: 'unused', data: { name: variable.name } });
      }
    },
  }),
};

/** Whether `identifier` names an import of the file that nothing else reads. */
function onlyReExported(sourceCode, identifier) {
  let scope = sourceCode.getScope(identifier);
  while (scope?.set.has(identifier.name) === false) scope = scope.upper;
  const variable = scope?.set.get(identifier.name);
  const definition = variable?.defs[0];
  return definition?.type === 'ImportBinding' && variable.references.length === 1;
}

/** S7763: an import that is only handed on is re-exported with `export ... from`. */
const preferExportFrom = {
  meta: { type: 'suggestion', schema: [], messages: { reexport: 'S7763: use `export ... from` to re-export `{{ name }}` instead of importing it first.' } },
  create: (context) => {
    const { sourceCode } = context;
    const check = (identifier, node) => {
      if (identifier?.type === 'Identifier' && onlyReExported(sourceCode, identifier)) context.report({ node, messageId: 'reexport', data: { name: identifier.name } });
    };
    return {
      ExportNamedDeclaration: (node) => {
        if (node.source) return;
        for (const specifier of node.specifiers) check(specifier.local, specifier);
        for (const declarator of node.declaration?.declarations ?? []) if (!declarator.id.typeAnnotation) check(declarator.init, declarator);
      },
      ExportDefaultDeclaration: (node) => check(node.declaration, node),
    };
  },
};

/** The members a props type declares: [{name, node}] from a type literal, an interface body, `Readonly<...>` or an intersection of those declared in the file. */
function declaredMembers(program, type) {
  if (!type) return [];
  if (type.type === 'TSTypeLiteral') return type.members.filter((member) => !member.computed && member.key).map((member) => ({ name: member.key.name ?? member.key.value, node: member.key }));
  if (type.type === 'TSIntersectionType') return type.types.flatMap((part) => declaredMembers(program, part));
  if (type.type !== 'TSTypeReference' || type.typeName.type !== 'Identifier') return [];
  if (type.typeName.name === 'Readonly') return declaredMembers(program, type.typeArguments?.params?.[0]);
  const declaration = program.body.map((statement) => statement.declaration ?? statement).find((statement) => (statement.type === 'TSTypeAliasDeclaration' || statement.type === 'TSInterfaceDeclaration') && statement.id.name === type.typeName.name);
  if (declaration?.type === 'TSInterfaceDeclaration') return declaredMembers(program, { type: 'TSTypeLiteral', members: declaration.body.body });
  return declaredMembers(program, declaration?.typeAnnotation);
}

const keyName = (key) => (key.type === 'Identifier' ? key.name : key.value);

/** The prop names a use of the parameter variable reads, or null when it escapes whole (passed on, spread, indexed dynamically). */
function readNames(variable) {
  const names = new Set();
  for (const reference of variable.references) {
    const parent = reference.identifier.parent;
    if (parent.type === 'MemberExpression' && parent.object === reference.identifier && (!parent.computed || parent.property.type === 'Literal')) names.add(keyName(parent.property));
    else if (parent.type === 'VariableDeclarator' && parent.init === reference.identifier && parent.id.type === 'ObjectPattern' && parent.id.properties.every((property) => property.type === 'Property' && !property.computed)) parent.id.properties.forEach((property) => names.add(keyName(property.key)));
    else return null;
  }
  return names;
}

/** The names a parameter reads: an object pattern's own keys, or what its variable's uses read; null means "all of them". */
function readByParameter(sourceCode, fn, parameter) {
  if (parameter.type === 'ObjectPattern') {
    if (parameter.properties.some((property) => property.type !== 'Property' || property.computed)) return null;
    return new Set(parameter.properties.map((property) => keyName(property.key)));
  }
  if (parameter.type !== 'Identifier') return null;
  const variable = sourceCode.getDeclaredVariables(fn).find((candidate) => candidate.name === parameter.name);
  return variable ? readNames(variable) : null;
}

/** S6767: a member of a component's props type that the component never reads is removed from the type. */
const noUnusedPropTypes = {
  meta: { type: 'suggestion', schema: [], messages: { unused: 'S6767: the prop `{{ name }}` is declared in the props type but the component never reads it; remove it.' } },
  create: (context) => {
    const { sourceCode } = context;
    const frames = [];
    const enter = (node) => frames.push({ node, jsx: false });
    const markJsx = () => frames.forEach((frame) => { frame.jsx = true; });
    const exit = () => {
      const { node, jsx } = frames.pop();
      const parameter = node.params[0];
      const annotation = parameter?.typeAnnotation?.typeAnnotation;
      if (!jsx || !annotation) return;
      const read = readByParameter(sourceCode, node, parameter);
      if (read === null) return;
      for (const member of declaredMembers(sourceCode.ast, annotation)) {
        if (!read.has(member.name)) context.report({ node: member.node, messageId: 'unused', data: { name: member.name } });
      }
    };
    return { FunctionDeclaration: enter, FunctionExpression: enter, ArrowFunctionExpression: enter, 'FunctionDeclaration:exit': exit, 'FunctionExpression:exit': exit, 'ArrowFunctionExpression:exit': exit, JSXElement: markJsx, JSXFragment: markJsx };
  },
};

/** The files the example scans leave out: a unit spec and an end-to-end spec. */
const OUTSIDE_THE_SCAN = /\.(?:e2e-)?spec\.[cm]?[jt]sx?$/;

/** The rule judging only the files the scan judges. */
const scanned = (rule) => ({ ...rule, create: (context) => (OUTSIDE_THE_SCAN.test(context.filename) ? {} : rule.create(context)) });

/** The rules both canons publish, by published name. */
export const SONAR_SYNTAX_RULES = Object.freeze({
  'no-await-in-loop': scanned(noAwaitInLoop),
  'prefer-code-point': scanned(preferCodePoint),
  'prefer-string-raw': scanned(preferStringRaw),
  'no-nested-conditional': scanned(noNestedConditional),
  'no-void-operator': scanned(noVoidOperator),
  'no-unused-import': scanned(noUnusedImport),
  'prefer-export-from': scanned(preferExportFrom),
  'no-unused-prop-types': scanned(noUnusedPropTypes),
});

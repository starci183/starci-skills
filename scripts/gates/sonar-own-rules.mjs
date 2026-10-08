// sonar-own-rules.mjs - the Sonar rules no published ESLint plugin ports for plain JavaScript, written for the `sonar-rules` gate:
//   S6582 prefer-optional-chain      a guard followed by the member access it guards (`a && a.b`, `!a || a.b !== c`) on a value that
//                                    is declared nullish (`let x = null`) or read with `?.` in the same function; Sonar judges
//                                    nullability with types, this is the syntactic part
//   S7727 callback-arity             an array callback that is a parameter or a function taking more than the element
//   S9383 floating-promise           a promise-returning call left as a statement (no await, void, catch or rejection handler)
//   S2871 no-alphabetical-sort       `.sort()` / `.toSorted()` without a comparator on anything not provably a string array
//                                    (sonarjs's port needs type information and stays silent on plain JavaScript)
//   S1516 no-line-separator-escape   a string that spells a line separator (U+2028, U+2029)
// Each one is calibrated against what SonarCloud reported on this project: it flags the shapes Sonar flagged and stays
// quiet on the shapes Sonar left alone (the hundreds of one-parameter function references passed to `.map`).
const ARRAY_METHODS = new Set(['map', 'filter', 'every', 'some', 'find', 'findIndex', 'findLast', 'findLastIndex', 'flatMap', 'forEach']);
const PROMISE_STATICS = new Set(['resolve', 'reject', 'all', 'allSettled', 'any', 'race']);
const NULLISH = new Set(['null', 'undefined']);
const STRING_SOURCES = new Set(['keys', 'getOwnPropertyNames', 'split', 'readdirSync', 'readdir']);
const KEEPS_ELEMENTS = new Set(['filter', 'slice', 'concat', 'reverse', 'flat', 'toSorted', 'sort']);
const COMPARISONS = new Set(['!=', '!==', '==', '===']);
const LINE_SEPARATOR = /\u202[89]|[\u2028\u2029]/;

const rule = (messages, create) => ({ meta: { type: 'suggestion', schema: [], messages }, create });
const nameOf = (callee) => (callee.type === 'MemberExpression' && !callee.computed ? callee.property.name : undefined);

/** The expression a nullish test is about (`a != null` -> a, `a !== undefined` -> a), or the node itself. */
function guarded(node, text) {
  if (node.type !== 'BinaryExpression' || !COMPARISONS.has(node.operator)) return node;
  const other = [node.left, node.right].find((side) => NULLISH.has(text(side)));
  return other ? [node.left, node.right].find((side) => side !== other) : node;
}

/** Whether `node` reads a member of the expression whose source is `guard` (at any depth of its left spine). */
function readsMemberOf(node, guard, text) {
  let current = node;
  while (current) {
    if (current.type === 'BinaryExpression') { current = current.left; continue; }
    if (current.type === 'UnaryExpression') { current = current.argument; continue; }
    if (current.type !== 'MemberExpression' && current.type !== 'CallExpression') return false;
    const inner = current.type === 'MemberExpression' ? current.object : current.callee;
    if (text(inner) === guard) return true;
    current = inner;
  }
  return false;
}

/** Whether `name` is a variable declared here as nullish (`let x = null`, `let x`, `= undefined`): the one nullability a syntax-only rule can know. */
function nullishBinding(scope, name) {
  for (let current = scope; current; current = current.upper) {
    const def = current.set.get(name)?.defs[0];
    if (!def) continue;
    const init = def.node?.init;
    return def.type === 'Variable' && (init === null || (init?.type === 'Literal' && init.value === null) || init?.name === 'undefined');
  }
  return false;
}

function optionalChainRule() {
  return rule({ use: 'Prefer using an optional chain expression instead, as it\'s more concise and easier to read.' }, (context) => {
    const text = (node) => context.sourceCode.getText(node);
    const nullable = (node, guard) => nullishBinding(context.sourceCode.getScope(node), guard)
      || context.sourceCode.getText(context.sourceCode.getAncestors(node).findLast((up) => /Function|Program/.test(up.type))).includes(`${guard}?.`);
    const leaf = (node) => (node.type === 'LogicalExpression' && node.operator === '&&' ? leaf(node.right) : node);
    const flagged = (node) => {
      if (node.type !== 'LogicalExpression') return false;
      const left = node.left.type === 'LogicalExpression' && node.left.operator === node.operator ? leaf(node.left) : node.left;
      if (node.operator === '&&') return readsMemberOf(node.right, text(guarded(left, text)), text) && nullable(node, text(guarded(left, text)));
      if (node.operator !== '||') return false;
      const negated = left.type === 'UnaryExpression' && left.operator === '!';
      const nullish = left.type === 'BinaryExpression' && ['==', '==='].includes(left.operator) && guarded(left, text) !== left;
      const subject = negated ? left.argument : guarded(left, text);
      const shaped = (negated && node.right.type === 'UnaryExpression' && node.right.operator === '!') || (node.right.type === 'BinaryExpression' && COMPARISONS.has(node.right.operator));
      return (negated || nullish) && shaped && readsMemberOf(node.right, text(subject), text) && nullable(node, text(subject));
    };
    return {
      LogicalExpression(node) {
        const parent = node.parent;
        const inChain = parent.type === 'LogicalExpression' && parent.operator === node.operator && parent.left === node && flagged(parent);
        if (flagged(node) && !inChain) context.report({ node, messageId: 'use' });
      },
    };
  });
}

/** The declared function a name is bound to in scope, as {parameter} or {params}; undefined when the binding is unknown. */
function bindingOf(scope, name) {
  for (let current = scope; current; current = current.upper) {
    const variable = current.set.get(name);
    if (!variable) continue;
    const def = variable.defs[0];
    if (!def) return { global: true };
    if (def.type === 'Parameter') return { parameter: true };
    const fn = def.type === 'FunctionName' ? def.node : def.node?.init;
    return fn && /Function/.test(fn.type) ? { params: fn.params } : undefined;
  }
  return { global: true };
}

const spendsExtraArguments = (params) => params.length > 1 || params.some((param) => param.type === 'RestElement' || param.type === 'AssignmentPattern');

function callbackArityRule() {
  return rule({ direct: 'Do not pass function `{{name}}` directly to `.{{method}}(…)`.' }, (context) => ({
    CallExpression(node) {
      const method = nameOf(node.callee);
      const [callback] = node.arguments;
      if (!ARRAY_METHODS.has(method) || callback?.type !== 'Identifier') return;
      const binding = bindingOf(context.sourceCode.getScope(node), callback.name);
      const risky = binding?.parameter || (binding?.params && spendsExtraArguments(binding.params)) || (binding?.global && callback.name === 'parseInt');
      if (risky) context.report({ node: callback, messageId: 'direct', data: { name: callback.name, method } });
    },
  }));
}

const settlesPromise = (callee) => ['catch', 'then', 'finally'].includes(nameOf(callee));

/** Whether the statement's call hands back a promise nobody awaits: Promise.*, a same-file async function, an open `.then` chain. */
function floatingCall(call, scope) {
  const { callee } = call;
  if (callee.type === 'MemberExpression' && callee.object.type === 'Identifier' && callee.object.name === 'Promise') return PROMISE_STATICS.has(nameOf(callee));
  if (settlesPromise(callee)) return nameOf(callee) !== 'catch' && (nameOf(callee) !== 'then' || call.arguments.length < 2);
  if (callee.type !== 'Identifier') return false;
  for (let current = scope; current; current = current.upper) {
    const def = current.set.get(callee.name)?.defs[0];
    if (!def) continue;
    const fn = def.type === 'FunctionName' ? def.node : def.node?.init;
    return Boolean(fn?.async);
  }
  return false;
}

function floatingPromiseRule() {
  return rule({ floating: 'Promises must be awaited, end with a call to .catch, end with a call to .then with a rejection handler or be explicitly marked as ignored with the `void` operator.' }, (context) => ({
    ExpressionStatement(node) {
      const { expression } = node;
      const promiseNew = expression.type === 'NewExpression' && expression.callee.name === 'Promise';
      const call = expression.type === 'CallExpression' && floatingCall(expression, context.sourceCode.getScope(node));
      if (promiseNew || call) context.report({ node, messageId: 'floating' });
    },
  }));
}

/** Whether a `.map` callback evidently returns strings (an arrow whose body is a template literal or String(...)). */
const mapsToStrings = (callback) => callback?.type === 'ArrowFunctionExpression'
  && (callback.body.type === 'TemplateLiteral' || (callback.body.type === 'CallExpression' && callback.body.callee.name === 'String'));

/** Whether the receiver of a sort is evidently an array of strings (readdirSync, Object.keys, a split, a literal of strings, or those filtered). */
function stringArray(node) {
  if (node.type === 'ArrayExpression') return node.elements.every((element) => element?.type === 'Literal' && typeof element.value === 'string');
  if (node.type !== 'CallExpression') return false;
  const method = nameOf(node.callee) ?? node.callee.name;
  if (STRING_SOURCES.has(method)) return true;
  if (method === 'map') return mapsToStrings(node.arguments[0]);
  return KEEPS_ELEMENTS.has(method) && node.callee.type === 'MemberExpression' && stringArray(node.callee.object);
}

function alphabeticalSortRule() {
  return rule({ compare: 'Provide a compare function to avoid sorting elements alphabetically.' }, (context) => ({
    CallExpression(node) {
      const method = nameOf(node.callee);
      if ((method === 'sort' || method === 'toSorted') && node.arguments.length === 0 && !stringArray(node.callee.object)) context.report({ node: node.callee.property, messageId: 'compare' });
    },
  }));
}

function lineSeparatorRule() {
  return rule({ escape: 'Multiline support is limited to browsers supporting ES5 only: spell the line terminators with a pattern, not with U+2028 or U+2029.' }, (context) => ({
    Literal(node) {
      if (typeof node.value === 'string' && LINE_SEPARATOR.test(node.raw)) context.report({ node, messageId: 'escape' });
    },
  }));
}

export const ownRules = Object.freeze({
  'prefer-optional-chain': optionalChainRule(),
  'callback-arity': callbackArityRule(),
  'floating-promise': floatingPromiseRule(),
  'no-alphabetical-sort': alphabeticalSortRule(),
  'no-line-separator-escape': lineSeparatorRule(),
});

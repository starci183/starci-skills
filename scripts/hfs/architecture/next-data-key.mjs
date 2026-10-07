function accessPath(deps, ts, checker, node) {
  node = deps.unwrapExpression(ts, node);
  if (ts.isIdentifier(node)) return { symbol: deps.normalizedSymbol(ts, checker, node), parts: [node.text] };
  if (ts.isPropertyAccessExpression(node)) {
    const base = accessPath(deps, ts, checker, node.expression);
    return base ? { symbol: base.symbol, parts: [...base.parts, node.name.text] } : null;
  }
  if (ts.isElementAccessExpression(node) && ts.isStringLiteralLike(node.argumentExpression)) {
    const base = accessPath(deps, ts, checker, node.expression);
    return base ? { symbol: base.symbol, parts: [...base.parts, node.argumentExpression.text] } : null;
  }
  return null;
}

function expandedIdentifierPath(deps, ts, checker, node, seen, depth) {
  const symbol = deps.normalizedSymbol(ts, checker, node);
  if (!symbol || seen.has(symbol)) return symbol ? { symbol, parts: [node.text] } : null;
  const initializer = deps.constInitializer(ts, symbol);
  return initializer ? expandedAccessPath(deps, ts, checker, initializer, new Set(seen).add(symbol), depth + 1)
    ?? { symbol, parts: [node.text] } : { symbol, parts: [node.text] };
}

function expandedMemberPath(deps, ts, checker, node, seen, depth) {
  const base = expandedAccessPath(deps, ts, checker, node.expression, seen, depth + 1);
  if (!base) return null;
  const part = ts.isPropertyAccessExpression(node) ? node.name.text : node.argumentExpression.text;
  return { symbol: base.symbol, parts: [...base.parts, part] };
}

function expandedAccessPath(deps, ts, checker, node, seen = new Set(), depth = 0) {
  if (!node || depth > 10) return null;
  node = deps.unwrapExpression(ts, node);
  if (ts.isIdentifier(node)) return expandedIdentifierPath(deps, ts, checker, node, seen, depth);
  if (ts.isPropertyAccessExpression(node)) return expandedMemberPath(deps, ts, checker, node, seen, depth);
  if (ts.isElementAccessExpression(node) && ts.isStringLiteralLike(node.argumentExpression)) return expandedMemberPath(deps, ts, checker, node, seen, depth);
  return null;
}

function matchesIdentityAccess(deps, ts, checker, node, identity) {
  const matches = access => access?.symbol === identity.symbol && access.parts.length >= identity.parts.length
    && identity.parts.every((part, index) => access.parts[index] === part);
  return matches(accessPath(deps, ts, checker, node)) || matches(expandedAccessPath(deps, ts, checker, node));
}

const expressionReferences = (deps, ts, checker, expression, identity) =>
  deps.anyDescendant(ts, expression, node => matchesIdentityAccess(deps, ts, checker, node, identity));

function propertyKey(ts, name) {
  if (ts.isIdentifier(name) || ts.isStringLiteralLike(name) || ts.isNumericLiteral(name)) return name.text;
  return null;
}

function effectiveObjectValues(ts, expression) {
  const selected = new Map();
  for (let index = expression.properties.length - 1; index >= 0; index -= 1) {
    const property = expression.properties[index];
    if (ts.isSpreadAssignment(property) || ts.isMethodDeclaration(property) || ts.isGetAccessorDeclaration(property)
      || ts.isSetAccessorDeclaration(property)) return null;
    const key = propertyKey(ts, property.name);
    if (key === null) return null;
    if (!selected.has(key)) selected.set(key, ts.isShorthandPropertyAssignment(property) ? property.name : property.initializer);
  }
  return [...selected.entries()].sort(([left], [right]) => left.localeCompare(right));
}

function combineContributions(values) {
  const states = new Set(values);
  return states.has('yes') && 'yes' || states.has('unproven') && 'unproven' || 'no';
}

function identityArrayContribution(deps, ts, checker, expression, identity, seen, depth) {
  if (expression.elements.some(element => ts.isSpreadElement(element))) return 'unproven';
  return combineContributions(expression.elements.map(element => identityContribution(deps, ts, checker, element, identity, seen, depth + 1)));
}

function identityObjectContribution(deps, ts, checker, expression, identity, seen, depth) {
  const values = effectiveObjectValues(ts, expression);
  if (!values || values.length !== expression.properties.length) return 'unproven';
  return combineContributions(values.map(([, value]) => identityContribution(deps, ts, checker, value, identity, seen, depth + 1)));
}

function identityBinaryContribution(deps, ts, checker, expression, identity, seen, depth) {
  if (expression.operatorToken.kind === ts.SyntaxKind.CommaToken) return identityContribution(deps, ts, checker, expression.right, identity, seen, depth + 1);
  if (expression.operatorToken.kind !== ts.SyntaxKind.QuestionQuestionToken) return expressionReferences(deps, ts, checker, expression, identity) ? 'unproven' : 'no';
  const left = identityContribution(deps, ts, checker, expression.left, identity, seen, depth + 1);
  const right = identityContribution(deps, ts, checker, expression.right, identity, seen, depth + 1);
  return (left === 'yes' || right === 'yes') && 'yes' || (left === 'unproven' || right === 'unproven') && 'unproven' || 'no';
}

function identityIdentifierContribution(deps, ts, checker, expression, identity, seen, depth) {
  const symbol = deps.normalizedSymbol(ts, checker, expression);
  if (!symbol || seen.has(symbol)) return 'no';
  const initializer = deps.constInitializer(ts, symbol);
  return initializer ? identityContribution(deps, ts, checker, initializer, identity, new Set(seen).add(symbol), depth + 1) : 'no';
}

function identityConditionalContribution(deps, ts, checker, expression, identity, seen, depth) {
  const whenTrue = identityContribution(deps, ts, checker, expression.whenTrue, identity, seen, depth + 1);
  const whenFalse = identityContribution(deps, ts, checker, expression.whenFalse, identity, seen, depth + 1);
  if (whenTrue === 'yes' && whenFalse === 'yes') return 'yes';
  if (whenTrue === 'unproven' || whenFalse === 'unproven') return 'unproven';
  return 'no';
}

function identityContribution(deps, ts, checker, expression, identity, seen = new Set(), depth = 0) {
  if (!expression || depth > 12) return 'unproven';
  expression = deps.unwrapExpression(ts, expression);
  if (matchesIdentityAccess(deps, ts, checker, expression, identity)) return 'yes';
  if (ts.isIdentifier(expression)) return identityIdentifierContribution(deps, ts, checker, expression, identity, seen, depth);
  if (ts.isConditionalExpression(expression)) return identityConditionalContribution(deps, ts, checker, expression, identity, seen, depth);
  if (ts.isBinaryExpression(expression)) return identityBinaryContribution(deps, ts, checker, expression, identity, seen, depth);
  if (ts.isPrefixUnaryExpression(expression)) return expressionReferences(deps, ts, checker, expression, identity) ? 'unproven' : 'no';
  if (ts.isTemplateExpression(expression)) return combineContributions(expression.templateSpans
    .map(span => identityContribution(deps, ts, checker, span.expression, identity, seen, depth + 1)));
  if (ts.isArrayLiteralExpression(expression)) return identityArrayContribution(deps, ts, checker, expression, identity, seen, depth);
  if (ts.isObjectLiteralExpression(expression)) return identityObjectContribution(deps, ts, checker, expression, identity, seen, depth);
  return ts.isCallExpression(expression) || ts.isNewExpression(expression) || ts.isAwaitExpression(expression) ? 'unproven' : 'no';
}

function returnedExpression(ts, fn) {
  if (ts.isArrowFunction(fn) && !ts.isBlock(fn.body)) return fn.body;
  if (!fn.body || !ts.isBlock(fn.body)) return null;
  const returns = [];
  const visit = node => {
    if (node !== fn.body && (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node) || ts.isMethodDeclaration(node))) return;
    if (ts.isReturnStatement(node) && node.expression) returns.push(node.expression);
    else ts.forEachChild(node, visit);
  };
  visit(fn.body);
  return returns.length === 1 ? returns[0] : null;
}

function rootKeyExpression(deps, ts, checker, expression, identities, seen = new Set(), depth = 0) {
  if (!expression || depth > 10) return null;
  expression = deps.unwrapExpression(ts, expression);
  if (ts.isArrowFunction(expression) || ts.isFunctionExpression(expression)) {
    const returned = returnedExpression(ts, expression);
    return returned ? rootKeyExpression(deps, ts, checker, returned, identities, seen, depth + 1) : null;
  }
  if (ts.isIdentifier(expression) && !identities.some(identity => identity.symbol === deps.normalizedSymbol(ts, checker, expression))) {
    const symbol = deps.normalizedSymbol(ts, checker, expression);
    const initializer = symbol && !seen.has(symbol) ? deps.constInitializer(ts, symbol) : null;
    if (initializer) return rootKeyExpression(deps, ts, checker, initializer, identities, new Set(seen).add(symbol), depth + 1);
  }
  return expression;
}

function staticObjectKey(deps, ts, checker, expression, identities, seen, depth) {
  const values = effectiveObjectValues(ts, expression);
  return values !== null && values.length === expression.properties.length
    && values.every(([, value]) => staticKeyExpression(deps, ts, checker, value, identities, seen, depth + 1));
}

function staticCompositeKey(deps, ts, checker, expression, identities, seen, depth) {
  if (ts.isTemplateExpression(expression)) return expression.templateSpans.every(span => staticKeyExpression(deps, ts, checker, span.expression, identities, seen, depth + 1));
  if (ts.isArrayLiteralExpression(expression)) return expression.elements.every(element => !ts.isSpreadElement(element)
    && staticKeyExpression(deps, ts, checker, element, identities, seen, depth + 1));
  if (ts.isObjectLiteralExpression(expression)) return staticObjectKey(deps, ts, checker, expression, identities, seen, depth);
  if (ts.isConditionalExpression(expression)) return staticKeyExpression(deps, ts, checker, expression.condition, identities, seen, depth + 1)
    && staticKeyExpression(deps, ts, checker, expression.whenTrue, identities, seen, depth + 1)
    && staticKeyExpression(deps, ts, checker, expression.whenFalse, identities, seen, depth + 1);
  if (ts.isBinaryExpression(expression)) return staticKeyExpression(deps, ts, checker, expression.left, identities, seen, depth + 1)
    && staticKeyExpression(deps, ts, checker, expression.right, identities, seen, depth + 1);
  if (ts.isPrefixUnaryExpression(expression)) return staticKeyExpression(deps, ts, checker, expression.operand, identities, seen, depth + 1);
  return null;
}

function staticIdentifierKey(deps, ts, checker, expression, identities, seen, depth) {
  if (expression.text === 'undefined' || identities.some(identity => identity.symbol === deps.normalizedSymbol(ts, checker, expression))) return true;
  const symbol = deps.normalizedSymbol(ts, checker, expression);
  if (!symbol || seen.has(symbol)) return false;
  const initializer = deps.constInitializer(ts, symbol);
  if (!initializer) return false;
  return staticKeyExpression(deps, ts, checker, initializer, identities, new Set(seen).add(symbol), depth + 1);
}

function staticKeyExpression(deps, ts, checker, expression, identities, seen = new Set(), depth = 0) {
  if (!expression || depth > 12) return false;
  expression = deps.unwrapExpression(ts, expression);
  if (expression.kind === ts.SyntaxKind.NullKeyword || expression.kind === ts.SyntaxKind.TrueKeyword
    || expression.kind === ts.SyntaxKind.FalseKeyword || ts.isStringLiteralLike(expression)
    || ts.isNumericLiteral(expression) || ts.isBigIntLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) return true;
  const composite = staticCompositeKey(deps, ts, checker, expression, identities, seen, depth);
  if (composite !== null) return composite;
  if (ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression)) {
    return identities.some(identity => expressionReferences(deps, ts, checker, expression, identity));
  }
  if (ts.isIdentifier(expression)) return staticIdentifierKey(deps, ts, checker, expression, identities, seen, depth);
  return false;
}

function keyLeaves(deps, ts, checker, expression, identities, decisions = [], depth = 0) {
  if (depth > 12) return null;
  expression = rootKeyExpression(deps, ts, checker, expression, identities);
  if (!expression) return null;
  if (ts.isConditionalExpression(expression)) {
    if (!staticKeyExpression(deps, ts, checker, expression.condition, identities)) return null;
    const whenTrue = keyLeaves(deps, ts, checker, expression.whenTrue, identities, [...decisions, { condition: expression.condition, branch: true }], depth + 1);
    const whenFalse = keyLeaves(deps, ts, checker, expression.whenFalse, identities, [...decisions, { condition: expression.condition, branch: false }], depth + 1);
    return whenTrue && whenFalse ? [...whenTrue, ...whenFalse] : null;
  }
  if (expression.kind === ts.SyntaxKind.NullKeyword) return [{ kind: 'null', expression, decisions }];
  return staticKeyExpression(deps, ts, checker, expression, identities) ? [{ kind: 'active', expression, decisions }] : null;
}

function nullish(deps, ts, checker, expression) {
  expression = deps.unwrapExpression(ts, expression);
  if (expression.kind === ts.SyntaxKind.NullKeyword) return true;
  if (!ts.isIdentifier(expression) || expression.text !== 'undefined') return false;
  const symbol = checker.getSymbolAtLocation(expression);
  return !symbol || (symbol.getDeclarations?.() ?? []).every(declaration => declaration.getSourceFile().isDeclarationFile);
}

function logicalBranchMeansAvailable(deps, ts, checker, condition, identity, branch) {
  const operator = condition.operatorToken.kind;
  if (operator !== ts.SyntaxKind.AmpersandAmpersandToken && operator !== ts.SyntaxKind.BarBarToken) return null;
  // `a && b` is true only when both sides are true; `a || b` is false only when both sides are false.
  const decisive = operator === ts.SyntaxKind.AmpersandAmpersandToken ? branch : !branch;
  return decisive && [condition.left, condition.right]
    .some(side => branchMeansAvailable(deps, ts, checker, side, identity, branch));
}

function equalityBranchMeansAvailable(deps, ts, checker, condition, identity, branch) {
  const operator = condition.operatorToken.kind;
  const leftIdentity = expressionReferences(deps, ts, checker, condition.left, identity) && nullish(deps, ts, checker, condition.right);
  const rightIdentity = expressionReferences(deps, ts, checker, condition.right, identity) && nullish(deps, ts, checker, condition.left);
  if (!leftIdentity && !rightIdentity) return false;
  if ([ts.SyntaxKind.ExclamationEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken].includes(operator)) return branch;
  if ([ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.EqualsEqualsEqualsToken].includes(operator)) return !branch;
  return false;
}

function branchMeansAvailable(deps, ts, checker, condition, identity, branch) {
  condition = deps.unwrapExpression(ts, condition);
  if (expressionReferences(deps, ts, checker, condition, identity) && (ts.isIdentifier(condition)
    || ts.isPropertyAccessExpression(condition) || ts.isElementAccessExpression(condition))) return branch;
  if (ts.isPrefixUnaryExpression(condition) && condition.operator === ts.SyntaxKind.ExclamationToken) {
    return branchMeansAvailable(deps, ts, checker, condition.operand, identity, !branch);
  }
  if (!ts.isBinaryExpression(condition)) return false;
  const logicalResult = logicalBranchMeansAvailable(deps, ts, checker, condition, identity, branch);
  if (logicalResult !== null) return logicalResult;
  return equalityBranchMeansAvailable(deps, ts, checker, condition, identity, branch);
}

function nonNullFalsy(deps, ts, expression) {
  expression = deps.unwrapExpression(ts, expression);
  return expression.kind === ts.SyntaxKind.FalseKeyword || ts.isStringLiteralLike(expression) && expression.text === ''
    || ts.isNumericLiteral(expression) && Number(expression.text) === 0
    || ts.isIdentifier(expression) && expression.text === 'undefined';
}

function containerSymbolsFromKey(deps, ts, checker, expression, found = new Set(), seen = new Set(), depth = 0) {
  if (!expression || depth > 12) return found;
  expression = deps.unwrapExpression(ts, expression);
  if (ts.isIdentifier(expression)) {
    const symbol = deps.normalizedSymbol(ts, checker, expression);
    if (!symbol || seen.has(symbol)) return found;
    const initializer = deps.constInitializer(ts, symbol);
    if (!initializer) return found;
    const value = deps.unwrapExpression(ts, initializer);
    if (ts.isArrayLiteralExpression(value) || ts.isObjectLiteralExpression(value)) found.add(symbol);
    containerSymbolsFromKey(deps, ts, checker, initializer, found, new Set(seen).add(symbol), depth + 1);
    return found;
  }
  ts.forEachChild(expression, child => { containerSymbolsFromKey(deps, ts, checker, child, found, seen, depth + 1); });
  return found;
}

function keyContainerRisks(deps, ts, checker, key, owner) {
  const symbols = containerSymbolsFromKey(deps, ts, checker, key);
  if (!symbols.size || !owner?.body) return [];
  const declarationNames = new Set([...symbols].flatMap(symbol => (symbol.getDeclarations?.() ?? [])
    .filter(ts.isVariableDeclaration).map(declaration => declaration.name)));
  const risks = [];
  const visit = node => {
    if (ts.isIdentifier(node) && symbols.has(deps.normalizedSymbol(ts, checker, node)) && !declarationNames.has(node)
      && !(node.pos >= key.pos && node.end <= key.end)) risks.push(node);
    ts.forEachChild(node, visit);
  };
  visit(owner.body);
  return risks;
}

function inspectIdentityKey(deps, scope, entry, call, identity, active) {
  const { config, context, violations, reasons } = scope;
  if (!active.length) {
    violations.push(deps.violation(config, call, entry.kind === 'mutation' && identity.resource ? deps.SWR_MUTATION_RULE_ID : deps.SWR_KEY_RULE_ID,
      `${entry.id} has no active key path carrying declared identity ${identity.id} (${identity.binding}).`,
      { lifecycle: entry.id, identity: identity.id }));
    return;
  }
  const contributions = new Set(active.map(leaf => identityContribution(deps, context.ts, call.checker, leaf.expression, identity)));
  if (contributions.has('unproven')) {
    reasons.push(`${entry.path}#${entry.export} key value contribution for identity ${identity.id} (${identity.binding}) cannot be proved on every active path`);
  } else if (contributions.has('no')) {
    const ruleId = entry.kind === 'mutation' && identity.resource ? deps.SWR_MUTATION_RULE_ID : deps.SWR_KEY_RULE_ID;
    violations.push(deps.violation(config, call, ruleId,
      `${entry.id} key must include declared ${identity.resource ? 'resource ' : ''}identity ${identity.id} (${identity.binding}) on every active key path.`,
      { lifecycle: entry.id, identity: identity.id }));
  }
  if (identity.gatesRequest) {
    const gated = active.every(leaf => leaf.decisions.some(decision => {
      return branchMeansAvailable(deps, context.ts, call.checker, decision.condition, identity, decision.branch);
    }));
    if (!gated) violations.push(deps.violation(config, call, deps.SWR_KEY_RULE_ID,
      `${entry.id} must produce an explicit null key when ${identity.id} (${identity.binding}) is unavailable.`,
      { lifecycle: entry.id, identity: identity.id }));
  }
}

function inspectKey(deps, scope, entry, call, identities) {
  const { config, context, violations, reasons } = scope;
  const key = call.node.arguments[0];
  if (!key) {
    reasons.push(`${entry.path}#${entry.export} has an SWR call without a key`);
    return;
  }
  const containerRisks = keyContainerRisks(deps, context.ts, call.checker, key, call.owner);
  if (containerRisks.length) {
    const locations = containerRisks.map(node => deps.sourceLocation(call.source, node).line).filter((line, index, all) => all.indexOf(line) === index);
    reasons.push(`${entry.path}#${entry.export} key container is referenced outside its declaration and selected SWR key` + (locations.length ? ` (line${'s'.repeat(Number(locations.length !== 1))} ${locations.join(', ')})` : ''));
    return;
  }
  const leaves = keyLeaves(deps, context.ts, call.checker, key, identities);
  if (!leaves) {
    reasons.push(`${entry.path}#${entry.export} uses a dynamic SWR key whose identity cannot be proved`);
    return;
  }
  const active = leaves.filter(leaf => leaf.kind === 'active');
  if (active.some(leaf => nonNullFalsy(deps, context.ts, leaf.expression))) violations.push(deps.violation(config, call, deps.SWR_KEY_RULE_ID,
    `${entry.id} uses explicit null, rather than another falsy value, for a disabled SWR key.`, { lifecycle: entry.id }));
  for (const identity of identities) inspectIdentityKey(deps, scope, entry, call, identity, active);
}

export function createNextDataKeyInspector(deps) {
  return (config, context, entry, call, identities, violations, reasons) => inspectKey(deps, { config, context, violations, reasons }, entry, call, identities);
}

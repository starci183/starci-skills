import path from 'node:path';
import { normalizedSymbolValue } from './ast-walks.mjs';
import { relativePath, unwrapExpression } from './typescript.mjs';
function importDeclarationFor(ts, node) {
  for (let current = node; current; current = current.parent) if (ts.isImportDeclaration(current)) return current;
  return null;
}

function isReactCreateElement(ts, checker, call) {
  const expression = unwrapExpression(ts, call.expression);
  if (ts.isIdentifier(expression)) {
    const symbol = checker.getSymbolAtLocation(expression);
    return (symbol?.declarations ?? []).some(declaration => {
      const imported = ts.isImportSpecifier(declaration) ? declaration.propertyName?.text ?? declaration.name.text : null;
      const parent = importDeclarationFor(ts, declaration);
      return imported === 'createElement' && parent && ts.isStringLiteralLike(parent.moduleSpecifier) && parent.moduleSpecifier.text === 'react';
    });
  }
  if (!ts.isPropertyAccessExpression(expression) || expression.name.text !== 'createElement') return false;
  const symbol = checker.getSymbolAtLocation(expression.expression);
  return (symbol?.declarations ?? []).some(declaration => {
    const parent = importDeclarationFor(ts, declaration);
    return (ts.isNamespaceImport(declaration) || ts.isImportClause(declaration))
      && parent && ts.isStringLiteralLike(parent.moduleSpecifier) && parent.moduleSpecifier.text === 'react';
  });
}

function jsxTagName(ts, tagName) {
  if (ts.isIdentifier(tagName)) return tagName.text;
  if (ts.isPropertyAccessExpression(tagName)) return tagName.name.text;
  return null;
}

function wrapperTag(ts, tagName) {
  const name = jsxTagName(ts, tagName);
  return name === 'Suspense' || name === 'SWRConfig' || name === 'Provider'
    || Boolean(name && (name.endsWith('Provider') || name.endsWith('ErrorBoundary')));
}

export class WorldRenderAnalysis {
  constructor(world, helpers) {
    this.world = world;
    this.helpers = helpers;
  }

  expressionHasRender(expression, checker, seen = new Set()) {
    expression = unwrapExpression(this.world.ts, expression);
    if (!expression) return false;
    if (this.world.ts.isJsxElement(expression) || this.world.ts.isJsxSelfClosingElement(expression) || this.world.ts.isJsxFragment(expression)) return true;
    if (this.world.ts.isCallExpression(expression) && isReactCreateElement(this.world.ts, checker, expression)) return true;
    if (this.world.ts.isConditionalExpression(expression)) return this.conditionalExpressionHasRender(expression, checker, seen);
    const logicalRender = this.logicalExpressionHasRender(expression, checker, seen);
    if (logicalRender !== null) return logicalRender;
    if (this.world.ts.isCallExpression(expression)) {
      const mapped = this.mappedExpressionHasRender(expression, checker, seen);
      if (mapped !== null) return mapped;
    }
    return this.referencedExpressionHasRender(expression, checker, seen);
  }

  conditionalExpressionHasRender(expression, checker, seen) {
    return this.expressionHasRender(expression.whenTrue, checker, seen)
      || this.expressionHasRender(expression.whenFalse, checker, seen);
  }

  logicalExpressionHasRender(expression, checker, seen) {
    const ts = this.world.ts;
    if (!ts.isBinaryExpression(expression) || ![ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken,
      ts.SyntaxKind.QuestionQuestionToken].includes(expression.operatorToken.kind)) return null;
    return this.expressionHasRender(expression.left, checker, seen) || this.expressionHasRender(expression.right, checker, seen);
  }

  mappedExpressionHasRender(expression, checker, seen) {
    const ts = this.world.ts;
    if (!ts.isPropertyAccessExpression(expression.expression) && !ts.isElementAccessExpression(expression.expression)) return null;
    let name = ts.isPropertyAccessExpression(expression.expression) ? expression.expression.name.text : null;
    if (name === null && ts.isStringLiteralLike(expression.expression.argumentExpression)) name = expression.expression.argumentExpression.text;
    if (name !== 'map' || !expression.arguments[0]) return null;
    return this.world.expressionFunctions(expression.arguments[0], checker).some(fn => this.functionHasRender(fn, checker, seen));
  }

  referencedExpressionHasRender(expression, checker, seen) {
    const ts = this.world.ts;
    const selected = ts.isCallExpression(expression) ? expression.expression : expression;
    const symbol = normalizedSymbolValue(ts, checker, this.helpers.selectedSymbol(ts, checker, selected));
    if (!symbol || seen.has(symbol)) return false;
    const nextSeen = new Set(seen).add(symbol);
    if (ts.isIdentifier(expression) && this.identifierInitializerHasRender(symbol, checker, nextSeen)) return true;
    if (ts.isCallExpression(expression)) return this.world.expressionFunctions(expression.expression, checker, seen)
      .some(fn => this.functionHasRender(fn, checker, nextSeen));
    return false;
  }

  identifierInitializerHasRender(symbol, checker, seen) {
    for (const declaration of symbol.getDeclarations?.() ?? []) {
      if (this.world.ts.isVariableDeclaration(declaration) && declaration.initializer
        && this.expressionHasRender(declaration.initializer, checker, seen)) return true;
    }
    return false;
  }

  functionHasRender(fn, checker, seen = new Set()) {
    if (this.world.renderOutputCache.has(fn)) return this.world.renderOutputCache.get(fn);
    this.world.renderOutputCache.set(fn, false);
    const found = this.helpers.returnedExpressions(this.world.ts, fn).some(expression => this.expressionHasRender(expression, checker, seen));
    this.world.renderOutputCache.set(fn, found);
    return found;
  }

  capturesOuterFunction(fn, checker) {
    const outers = [];
    for (let parent = fn.parent; parent; parent = parent.parent) if (this.world.ts.isFunctionLike(parent)) outers.push(parent);
    if (!outers.length) return false;
    const capture = { found: false };
    this.visitOuterReferences(fn.body ?? fn, fn, checker, outers, capture);
    return capture.found;
  }

  visitOuterReferences(node, fn, checker, outers, capture) {
    if (capture.found) return;
    if (this.referencesOuterFunction(node, fn, checker, outers)) {
      capture.found = true;
      return;
    }
    this.world.ts.forEachChild(node, child => this.visitOuterReferences(child, fn, checker, outers, capture));
  }

  referencesOuterFunction(node, fn, checker, outers) {
    if (!this.world.ts.isIdentifier(node)) return false;
    const symbol = checker.getSymbolAtLocation(node);
    for (const declaration of symbol?.getDeclarations?.() ?? []) {
      if (declaration.pos >= fn.pos && declaration.end <= fn.end) continue;
      if (outers.some(outer => declaration.pos >= outer.pos && declaration.end <= outer.end)) return true;
    }
    return false;
  }

  pureRenderTarget(expression, checker, expectedFile = null) {
    const functions = this.world.expressionFunctions(expression, checker);
    return functions.length > 0 && functions.every(fn => this.world.sourceSet.has(path.resolve(fn.getSourceFile().fileName))
      && (this.world.insideAny(this.world.roots.components, fn.getSourceFile().fileName) || this.world.insideAny(this.world.roots.features, fn.getSourceFile().fileName))
      && (!expectedFile || path.resolve(fn.getSourceFile().fileName) === expectedFile)
      && this.functionHasRender(fn, checker) && !this.world.functionUsesWorld(fn, checker) && !this.capturesOuterFunction(fn, checker));
  }

  expressionSuppliesRender(expression, checker) {
    return this.expressionHasRender(expression, checker)
      || this.world.expressionFunctions(expression, checker).some(fn => this.functionHasRender(fn, checker));
  }

  routedLayoutChild(opening, child, checker) {
    const ts = this.world.ts;
    if (!ts.isJsxExpression(child) || !child.expression) return false;
    const source = opening.getSourceFile().fileName;
    if (!/^apps\/[^/]+\/src\/features\/layouts\/[^/]+\/index\.tsx$/.test(relativePath(this.world.config.root, source))) return false;
    const sibling = path.resolve(path.dirname(source), 'component.tsx');
    if (!this.pureRenderTarget(opening.tagName, checker, sibling)) return false;
    const value = unwrapExpression(ts, child.expression);
    if (!ts.isPropertyAccessExpression(value) || !['content', 'children'].includes(value.name.text)) return false;
    const receiver = unwrapExpression(ts, value.expression);
    if (!ts.isIdentifier(receiver)) return false;
    const symbol = checker.getSymbolAtLocation(receiver);
    return (symbol?.getDeclarations?.() ?? []).some(declaration => ts.isParameter(declaration));
  }

  renderBoundary(expression, checker, seen = new Set(), allowEmpty = false, expectedFile = null) {
    const ts = this.world.ts;
    expression = unwrapExpression(ts, expression);
    if (!expression) return allowEmpty;
    if (expression.kind === ts.SyntaxKind.NullKeyword || expression.kind === ts.SyntaxKind.FalseKeyword) return allowEmpty;
    if (ts.isConditionalExpression(expression)) return this.conditionalRenderBoundary(expression, checker, seen, allowEmpty, expectedFile);
    if (ts.isBinaryExpression(expression) && expression.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
      return this.renderBoundary(expression.right, checker, seen, true, expectedFile);
    }
    if (ts.isArrayLiteralExpression(expression)) return this.arrayRenderBoundary(expression, checker, seen, allowEmpty, expectedFile);
    if (ts.isIdentifier(expression)) return this.identifierRenderBoundary(expression, checker, seen, allowEmpty, expectedFile);
    if (ts.isCallExpression(expression)) return this.callRenderBoundary(expression, checker, seen, expectedFile);
    if (ts.isJsxFragment(expression)) return this.fragmentRenderBoundary(expression, checker, seen, expectedFile);
    if (ts.isJsxElement(expression) || ts.isJsxSelfClosingElement(expression)) return this.jsxRenderBoundary(expression, checker, seen, expectedFile);
    return false;
  }

  conditionalRenderBoundary(expression, checker, seen, allowEmpty, expectedFile) {
    return this.renderBoundary(expression.whenTrue, checker, seen, allowEmpty, expectedFile)
      && this.renderBoundary(expression.whenFalse, checker, seen, allowEmpty, expectedFile);
  }

  arrayRenderBoundary(expression, checker, seen, allowEmpty, expectedFile) {
    return expression.elements.length > 0
      && expression.elements.every(item => this.renderBoundary(item, checker, seen, allowEmpty, expectedFile));
  }

  identifierRenderBoundary(expression, checker, seen, allowEmpty, expectedFile) {
    const symbol = normalizedSymbolValue(this.world.ts, checker, checker.getSymbolAtLocation(expression));
    if (!symbol || seen.has(symbol)) return false;
    const nextSeen = new Set(seen).add(symbol);
    const values = (symbol.getDeclarations?.() ?? []).flatMap(declaration => this.world.ts.isVariableDeclaration(declaration) && declaration.initializer
      ? [declaration.initializer] : []);
    if (values.length) return values.every(value => this.renderBoundary(value, checker, nextSeen, allowEmpty, expectedFile));
    return false;
  }

  callRenderBoundary(expression, checker, seen, expectedFile) {
    if (isReactCreateElement(this.world.ts, checker, expression)) return this.createElementBoundary(expression, checker, seen, expectedFile);
    const mapped = this.mappedCallBoundary(expression, checker, seen, expectedFile);
    if (mapped !== null) return mapped;
    return this.pureRenderTarget(expression.expression, checker, expectedFile);
  }

  createElementBoundary(expression, checker, seen, expectedFile) {
    const ts = this.world.ts;
    const target = expression.arguments[0] ? unwrapExpression(ts, expression.arguments[0]) : null;
    if (!target || ts.isStringLiteralLike(target)) return false;
    const pureTarget = this.pureRenderTarget(target, checker, expectedFile) && !wrapperTag(ts, target);
    const wrapper = wrapperTag(ts, target);
    if (!pureTarget && !wrapper) return false;
    const boundary = { hasBoundary: pureTarget };
    const props = expression.arguments[1] ? unwrapExpression(ts, expression.arguments[1]) : null;
    if (!this.createElementPropsBoundary(props, checker, seen, expectedFile, boundary)) return false;
    const children = expression.arguments.slice(2);
    if (children.length) {
      if (!children.every(child => this.renderBoundary(child, checker, seen, false, expectedFile))) return false;
      boundary.hasBoundary = true;
    }
    return boundary.hasBoundary;
  }

  createElementPropsBoundary(props, checker, seen, expectedFile, boundary) {
    const ts = this.world.ts;
    if (!props || props.kind === ts.SyntaxKind.NullKeyword) return true;
    if (!ts.isObjectLiteralExpression(props) || props.properties.some(property => ts.isSpreadAssignment(property))) return false;
    for (const property of props.properties) {
      if (!ts.isPropertyAssignment(property)) continue;
      const value = unwrapExpression(ts, property.initializer);
      if (!this.expressionSuppliesRender(value, checker)) continue;
      if (!this.pureRenderTarget(value, checker, expectedFile) && !this.renderBoundary(value, checker, seen, true, expectedFile)) return false;
      const name = property.name && (ts.isIdentifier(property.name) || ts.isStringLiteralLike(property.name)) ? property.name.text : null;
      if (['children', 'component', 'content', 'render', 'view'].includes(name)) boundary.hasBoundary = true;
    }
    return true;
  }

  mappedCallBoundary(expression, checker, seen, expectedFile) {
    const ts = this.world.ts;
    if (!ts.isPropertyAccessExpression(expression.expression) && !ts.isElementAccessExpression(expression.expression)) return null;
    let name = ts.isPropertyAccessExpression(expression.expression) ? expression.expression.name.text : null;
    if (name === null && ts.isStringLiteralLike(expression.expression.argumentExpression)) name = expression.expression.argumentExpression.text;
    if (name !== 'map' || !expression.arguments[0]) return null;
    const renderers = this.world.expressionFunctions(expression.arguments[0], checker);
    return renderers.length > 0 && renderers.every(fn => !this.world.functionUsesWorld(fn, checker)
      && this.helpers.returnedExpressions(ts, fn).length > 0
      && this.helpers.returnedExpressions(ts, fn).every(value => this.renderBoundary(value, checker, seen, true, expectedFile)));
  }

  fragmentRenderBoundary(expression, checker, seen, expectedFile) {
    const ts = this.world.ts;
    const children = expression.children.filter(child => !ts.isJsxText(child) || child.text.trim());
    return children.length > 0 && children.every(child => !ts.isJsxText(child)
      && this.renderBoundary(ts.isJsxExpression(child) ? child.expression : child, checker, seen, false, expectedFile));
  }

  jsxRenderBoundary(expression, checker, seen, expectedFile) {
    const ts = this.world.ts;
    const opening = ts.isJsxElement(expression) ? expression.openingElement : expression;
    const pureTarget = this.pureRenderTarget(opening.tagName, checker, expectedFile) && !wrapperTag(ts, opening.tagName);
    const wrapper = wrapperTag(ts, opening.tagName);
    if (!pureTarget && !wrapper) return false;
    const boundary = { hasBoundary: pureTarget };
    if (!this.jsxChildrenBoundary(expression, opening, checker, seen, expectedFile, pureTarget, boundary)) return false;
    if (!this.jsxAttributesBoundary(opening, checker, seen, expectedFile, boundary)) return false;
    return boundary.hasBoundary;
  }

  jsxChildrenBoundary(expression, opening, checker, seen, expectedFile, pureTarget, boundary) {
    const ts = this.world.ts;
    const children = ts.isJsxElement(expression)
      ? expression.children.filter(child => !ts.isJsxText(child) || child.text.trim()) : [];
    if (!children.length) return true;
    const routedChild = pureTarget && children.length === 1 && this.routedLayoutChild(opening, children[0], checker);
    if (!routedChild && !children.every(child => !ts.isJsxText(child)
      && this.renderBoundary(ts.isJsxExpression(child) ? child.expression : child, checker, seen, false, expectedFile))) return false;
    boundary.hasBoundary = true;
    return true;
  }

  jsxAttributesBoundary(opening, checker, seen, expectedFile, boundary) {
    const ts = this.world.ts;
    for (const attribute of opening.attributes.properties) {
      if (!ts.isJsxAttribute(attribute) || !attribute.initializer) continue;
      const name = attribute.name.text;
      if (['fallback', 'errorElement'].includes(name)) {
        if (ts.isStringLiteral(attribute.initializer)) return false;
        if (ts.isJsxExpression(attribute.initializer)
          && !this.renderBoundary(attribute.initializer.expression, checker, seen, true, expectedFile)) return false;
      }
      if (ts.isJsxExpression(attribute.initializer) && attribute.initializer.expression
        && this.expressionSuppliesRender(attribute.initializer.expression, checker)) {
        if (!this.pureRenderTarget(attribute.initializer.expression, checker, expectedFile)
          && !this.renderBoundary(attribute.initializer.expression, checker, seen, true, expectedFile)) return false;
        if (['component', 'content', 'render', 'view'].includes(name)) boundary.hasBoundary = true;
      }
    }
    return true;
  }
}

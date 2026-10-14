import path from 'node:path';
import { normalizedSymbolValue } from './ast-walks.mjs';
import { unwrapExpression } from './typescript.mjs';

/** Feature composition may inject block renders into a pure view without making the view a world owner. */
export class BlockRenderAnalysis {
  constructor(renderer) {
    this.renderer = renderer;
    this.world = renderer.world;
  }

  featureComposition(expression, expectedFile) {
    const file = expression?.getSourceFile().fileName;
    return Boolean(file && !expectedFile && this.world.insideAny(this.world.roots.features, file)
      && path.basename(file) === 'index.tsx');
  }

  renderProp(expression, checker, expectedFile) {
    return this.featureComposition(expression, expectedFile) && this.renderValue(expression, checker);
  }

  blockTarget(expression, checker) {
    const functions = this.world.expressionFunctions(expression, checker);
    return functions.length > 0 && functions.every(fn => {
      const file = fn.getSourceFile().fileName;
      return this.world.sourceSet.has(path.resolve(file)) && path.basename(file) === 'index.tsx'
        && this.world.tierOf(this.world.roots.components, file)?.tier === 'blocks'
        && this.renderer.functionHasRender(fn, checker);
    });
  }

  callbacksRender(functions, checker, seen) {
    return functions.length > 0 && functions.every(fn => {
      const values = this.renderer.helpers.returnedExpressions(this.world.ts, fn);
      return !this.world.functionUsesWorld(fn, checker) && values.length > 0
        && values.every(value => this.renderValue(value, checker, seen));
    });
  }

  renderValue(input, checker, seen = new Set()) {
    const ts = this.world.ts;
    const value = unwrapExpression(ts, input);
    if (!value) return false;
    if (value.kind === ts.SyntaxKind.NullKeyword || value.kind === ts.SyntaxKind.FalseKeyword) return true;
    if (ts.isConditionalExpression(value)) return this.renderValue(value.whenTrue, checker, seen)
      && this.renderValue(value.whenFalse, checker, seen);
    if (ts.isBinaryExpression(value) && value.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken)
      return this.renderValue(value.right, checker, seen);
    if (ts.isArrayLiteralExpression(value)) return value.elements.every(item => this.renderValue(item, checker, seen));
    if (ts.isJsxFragment(value)) return this.fragmentBlocks(value, checker, seen);
    if (ts.isJsxElement(value) || ts.isJsxSelfClosingElement(value)) return this.jsxBlock(value, checker, seen);
    if (ts.isCallExpression(value)) return this.createdBlock(value, checker, seen) || this.mappedBlocks(value, checker, seen);
    if (ts.isArrowFunction(value) || ts.isFunctionExpression(value)) return this.callbacksRender([value], checker, seen);
    return this.referencedBlocks(value, checker, seen);
  }

  fragmentBlocks(value, checker, seen) {
    const ts = this.world.ts;
    return value.children.every(child => {
      if (ts.isJsxText(child)) return !child.text.trim();
      return this.renderValue(ts.isJsxExpression(child) ? child.expression : child, checker, seen);
    });
  }

  jsxBlock(value, checker, seen) {
    const ts = this.world.ts;
    const opening = ts.isJsxElement(value) ? value.openingElement : value;
    if (!this.blockTarget(opening.tagName, checker)) return false;
    const boundary = { hasBoundary: true };
    return this.renderer.jsxChildrenBoundary(value, opening, checker, seen, null, false, boundary)
      && this.renderer.jsxAttributesBoundary(opening, checker, seen, null, boundary);
  }

  mappedBlocks(value, checker, seen) {
    const ts = this.world.ts;
    const callee = unwrapExpression(ts, value.expression);
    if (!ts.isPropertyAccessExpression(callee) && !ts.isElementAccessExpression(callee)) return false;
    let name = ts.isPropertyAccessExpression(callee) ? callee.name.text : null;
    if (name === null && ts.isStringLiteralLike(callee.argumentExpression)) name = callee.argumentExpression.text;
    return name === 'map' && value.arguments.length > 0
      && this.callbacksRender(this.world.expressionFunctions(value.arguments[0], checker), checker, seen);
  }

  createdBlock(value, checker, seen) {
    const ts = this.world.ts;
    if (!this.renderer.isCreateElement(value, checker) || !value.arguments[0]
      || !this.blockTarget(value.arguments[0], checker)) return false;
    const boundary = { hasBoundary: true };
    const props = value.arguments[1] ? unwrapExpression(ts, value.arguments[1]) : null;
    return this.renderer.createElementPropsBoundary(props, checker, seen, null, boundary, false)
      && value.arguments.slice(2).every(child => this.renderer.renderBoundary(child, checker, seen));
  }

  referencedBlocks(value, checker, seen) {
    const ts = this.world.ts;
    const symbol = normalizedSymbolValue(ts, checker, this.renderer.helpers.selectedSymbol(ts, checker, value));
    if (!symbol || seen.has(symbol)) return false;
    const nextSeen = new Set(seen).add(symbol);
    const values = (symbol.getDeclarations?.() ?? []).flatMap(declaration => ts.isVariableDeclaration(declaration)
      && declaration.initializer ? [declaration.initializer] : []);
    if (values.length) return values.every(item => this.renderValue(item, checker, nextSeen));
    return this.callbacksRender(this.world.expressionFunctions(value, checker), checker, nextSeen);
  }
}

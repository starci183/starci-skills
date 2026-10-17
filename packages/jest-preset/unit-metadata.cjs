"use strict"

const METADATA_SOURCE = require.resolve("./unit-metadata.generated.cjs")
const METADATA_TEXT = require("node:fs").readFileSync(METADATA_SOURCE, "utf8")

/** Only synthetic conditional guards inside compiler-emitted parameter metadata map to the dedicated ignore anchor. */
function factory(compiler) {
  const ts = compiler.configSet.compilerModule
  const source = ts.createSourceMapSource(METADATA_SOURCE, METADATA_TEXT)
  return (context) => {
    const visit = (node) => {
      if (isGeneratedMetadata(ts, node)) {
        const guard = (child) => {
          if (isGeneratedGuard(ts, child)) {
            ts.setSourceMapRange(child, { pos: METADATA_TEXT.indexOf("\n") + 1, end: METADATA_TEXT.length - 1, source })
            ts.setEmitFlags(child, ts.getEmitFlags(child) | ts.EmitFlags.NoNestedSourceMaps)
            return child
          }
          return ts.visitEachChild(child, guard, context)
        }
        return ts.visitEachChild(node, guard, context)
      }
      return ts.visitEachChild(node, visit, context)
    }
    return (file) => ts.visitNode(file, visit)
  }
}

/** Only TypeScript's synthetic __metadata("design:paramtypes", ...) call is eligible; source calls remain measured. */
function isGeneratedMetadata(ts, node) {
  return node.pos < 0 && ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "__metadata" && node.arguments.length === 2 && ts.isStringLiteral(node.arguments[0]) && node.arguments[0].text === "design:paramtypes"
}

/** A metadata exclusion requires TypeScript's synthetic `typeof value === "function" ? value : Object` guard shape. */
function isGeneratedGuard(ts, node) {
  if (node.pos >= 0 || !ts.isConditionalExpression(node)) return false
  const condition = node.condition
  return ts.isBinaryExpression(condition) && condition.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken && ts.isTypeOfExpression(condition.left) && ts.isStringLiteral(condition.right) && condition.right.text === "function" && ts.isIdentifier(node.whenFalse) && node.whenFalse.text === "Object"
}

/** ts-jest normalizes map sources to the input file; restore the generated metadata anchor before Jest reads the map. */
function restoreMetadataSource(result) {
  const prefix = "sourceMappingURL=data:application/json;charset=utf-8;base64,"
  const offset = result.code.lastIndexOf(prefix)
  if (offset < 0) return result
  const start = offset + prefix.length
  const map = JSON.parse(Buffer.from(result.code.slice(start), "base64").toString("utf8"))
  if (map.sourcesContent?.length !== 2 || map.sourcesContent[1] !== METADATA_TEXT) return result
  map.sources = [map.sources[0], METADATA_SOURCE]
  return { ...result, code: result.code.slice(0, start) + Buffer.from(JSON.stringify(map)).toString("base64") }
}

/** Unit transforms delegate compilation and caching to ts-jest; the after-transformer changes metadata mappings only. */
function createTransformer(options) {
  const delegate = require("ts-jest").default.createTransformer(options)
  return {
    getCacheKey: (...args) => delegate.getCacheKey(...args) + ":starci-unit-metadata-5",
    process: (...args) => restoreMetadataSource(delegate.process(...args)),
    processAsync: async (...args) => restoreMetadataSource(await delegate.processAsync(...args)),
  }
}

module.exports = { name: "starci-unit-metadata", version: 5, factory, createTransformer }

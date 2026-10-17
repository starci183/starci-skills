"use strict"

const { createRequire } = require("node:module")
const fromJest = createRequire(require.resolve("jest"))
const fromCore = createRequire(fromJest.resolve("@jest/core"))
const fromReporters = createRequire(fromCore.resolve("@jest/reporters"))
const LcovReport = fromReporters("istanbul-reports").create("lcov").constructor
const METADATA_SOURCE = require.resolve("./unit-metadata.generated.cjs")

/** LCOV identifies functions by name; append their stable coverage id so same-named callbacks retain separate counts. */
class StarciLcovReport extends LcovReport {
  onDetail(node, context) {
    if (node.getFileCoverage().path === METADATA_SOURCE) return
    const entries = Object.entries(node.getFileCoverage().fnMap)
    const names = entries.map(([, meta]) => meta.name)
    try {
      entries.forEach(([id, meta]) => { meta.name = `${meta.name}#${id}` })
      super.onDetail(node, context)
    } finally {
      entries.forEach(([, meta], index) => { meta.name = names[index] })
    }
  }
}

module.exports = StarciLcovReport

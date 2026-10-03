// bound-sys.cjs - the typed ESLint run never reads types from above the app root.
//
// `starci app lint` starts ESLint with `node --require <this file>` and STARCI_LINT_BOUND set to the app root. typescript-eslint's
// projectService builds its server host from `tsserver.sys` (typescript/lib/tsserverlibrary) and exposes no host through
// parserOptions, so without a bound a typed rule reads types from an enclosing repository's node_modules and judges the app
// greener than its own install allows. Here `sys` of the app's own TypeScript is patched, in place and before ESLint loads
// the parser, to answer only for paths inside the app root and TypeScript's own lib directory (the same bound the gate's
// tsc programs use, scripts/gates/gate.mjs boundedSys). realpath is the identity, so an install junctioned inside the app
// stays inside it. Nothing is patched when STARCI_LINT_BOUND is unset or TypeScript is not installed (nothing typed runs).
'use strict'
const path = require('node:path')
const { createRequire } = require('node:module')

const key = (p) => path.resolve(String(p)).replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()

/** Patch `sys` (the TypeScript system object) so it answers only for paths inside `bound` and `libDir`. Returns `sys`. */
function bindSys(sys, bound, libDir) {
    const roots = [key(bound), key(libDir)]
    const inside = (p) => {
        const k = key(p)
        return roots.some((root) => k === root || k.startsWith(`${root}/`))
    }
    const base = { ...sys }
    return Object.assign(sys, {
        fileExists: (p) => inside(p) && base.fileExists(p),
        directoryExists: (p) => inside(p) && base.directoryExists(p),
        readFile: (p, encoding) => (inside(p) ? base.readFile(p, encoding) : undefined),
        getDirectories: (p) => (inside(p) ? base.getDirectories(p) : []),
        readDirectory: (dir, ext, exclude, include, depth) => (inside(dir) ? base.readDirectory(dir, ext, exclude, include, depth).filter(inside) : []),
        realpath: (p) => p,
    })
}

/** Bind the `sys` of every TypeScript entry the typed lint loads, resolved from `from` (a side folder of the app). */
function bindTypeScript(bound, from) {
    const require_ = createRequire(path.join(from, 'package.json'))
    const bound_ = [];
    for (const entry of ['typescript/lib/tsserverlibrary', 'typescript']) {
        let ts
        try { ts = require_(entry) } catch { continue }
        if (!ts?.sys || bound_.includes(ts.sys)) continue
        bindSys(ts.sys, bound, path.dirname(ts.getDefaultLibFilePath({})))
        bound_.push(ts.sys)
    }
    return bound_.length
}

if (process.env.STARCI_LINT_BOUND) bindTypeScript(process.env.STARCI_LINT_BOUND, process.cwd())

module.exports = { bindSys, bindTypeScript }

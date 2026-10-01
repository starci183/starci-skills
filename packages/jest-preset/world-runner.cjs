"use strict"

/**
 * The runner of the integration, e2e and contract projects: every spec file runs in a process of its own.
 *
 * Why: jest runs a file in a fresh vm context, but a context still reaches the globals of the process that hosts it, and
 * jest-environment-node exposes every global the host process had when the environment loaded. The test world's globalSetup
 * runs in jest's main process and loads application code there (the migrate step and its modules), so a framework that keeps
 * its registry on a process global (`@nestjs/graphql` keeps `GqlTypeMetadataStorage` on `global`) leaks it into every file
 * jest runs in that process; and a worker that runs several files carries whatever the first one left on its own global. In
 * one `npm run test:e2e` the second file then fails to boot with "Cannot determine a GraphQL output type". Resetting the
 * framework's storage would chase one framework at a time; a process per file isolates every one of them.
 *
 * How: the stock jest-runner, driven one file at a time with a single-worker farm (`maxWorkers: 1` per file), which forks a
 * fresh child, runs the file there and ends the child. Never in band, even when jest would choose it (one worker, one test,
 * `--runInBand`): the main process holds the globalSetup's state. Files still run `--maxWorkers` at a time; the outage specs
 * of a run are serialized by the test world's outage lock (@starci/test-world), not by the runner.
 */

const { createRequire } = require("node:module")
const path = require("node:path")

/**
 * The stock jest-runner of the jest that loads this preset: resolved through jest's own dependency chain
 * (jest -> @jest/core -> jest-runner) from the repository root, so the runner always matches the running jest.
 */
function stockRunner(root = process.cwd()) {
  const fromRoot = createRequire(path.join(root, "package.json"))
  const fromJest = createRequire(fromRoot.resolve("jest/package.json"))
  const fromCore = createRequire(fromJest.resolve("@jest/core"))
  const loaded = fromCore("jest-runner")
  return loaded.default ?? loaded
}

const StockRunner = stockRunner()

class WorldRunner extends StockRunner {
  #listeners = []

  /** Jest subscribes before the run; the subscriptions are handed to the per-file runner of each file. */
  on(eventName, listener) {
    const entry = { eventName, listener }
    this.#listeners.push(entry)
    return () => {
      this.#listeners = this.#listeners.filter((candidate) => candidate !== entry)
    }
  }

  /** Runs each file in a fresh worker process, at most `maxWorkers` at a time; `serial` (in band) is never honoured. */
  async runTests(tests, watcher) {
    const perFile = { ...this._globalConfig, maxWorkers: 1 }
    const queue = [...tests]
    const lane = async () => {
      for (let test = queue.shift(); test !== undefined; test = queue.shift()) {
        if (watcher.isInterrupted()) return
        const runner = new StockRunner(perFile, this._context)
        const unsubscribe = this.#listeners.map(({ eventName, listener }) => runner.on(eventName, listener))
        try {
          await runner.runTests([test], watcher, { serial: false })
        } finally {
          for (const stop of unsubscribe) stop()
        }
      }
    }
    const lanes = Math.max(1, Math.min(this._globalConfig.maxWorkers, tests.length))
    await Promise.all(Array.from({ length: lanes }, lane))
  }
}

module.exports = WorldRunner

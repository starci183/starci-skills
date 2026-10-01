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
 * `--runInBand`): the main process holds the globalSetup's state.
 *
 * ONE FILE AT A TIME, whatever `--maxWorkers` says: every file of a run shares the run's data (the test world resets the run's
 * databases, realm users, Redis DB and fakes when a file boots), so a second file running beside the first would wipe what the
 * first is using. The runner enforces it, so no flag or script can turn it off. Per-worker data namespaces are the known
 * limitation that lifts it (see CHANGELOG 2.2.0).
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

  /** Runs the files one after another, each in a fresh worker process; `--maxWorkers` and `serial` (in band) are never honoured. */
  async runTests(tests, watcher) {
    const perFile = { ...this._globalConfig, maxWorkers: 1 }
    for (const test of tests) {
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
}

module.exports = WorldRunner

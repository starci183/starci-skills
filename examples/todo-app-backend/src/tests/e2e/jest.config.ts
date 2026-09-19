import os from "node:os"
import path from "node:path"
import type {
    Config 
} from "jest"

/**
 * The e2e project's own Jest config, kept separate from the backend's `jest.config.js` on purpose:
 * the unit suite is an in-process suite with fakes, this one boots real infra per spec
 * (TestingInfraModule) and talks to it over HTTP. `npm test` never runs these files; e2e specs run
 * through `npm run test:e2e` or `npx jest --config test/e2e/jest.config.ts <path>`.
 */
const config: Config = {
    rootDir: path.resolve(__dirname,
        "..",
        "..",
        ".."),
    // A root-relative glob, not `<rootDir>/...`: jest's substitution leaves a mixed-separator pattern
    // on Windows that micromatch then matches nothing against.
    roots: ["<rootDir>/src/tests/e2e"],
    testEnvironment: "node",
    transform: {
        "^.+\\.ts$": ["ts-jest",
            {
                tsconfig: "<rootDir>/tsconfig.json" 
            }],
    },
    testMatch: ["**/*.e2e-spec.ts"],
    moduleFileExtensions: ["ts",
        "js",
        "json"],
    moduleNameMapper: {
        "^@e2e-kit/(.*)$": "<rootDir>/../../packages/e2e-kit/src/$1",
        "^@modules/(.*)$": "<rootDir>/src/modules/$1",
        "^@features/(.*)$": "<rootDir>/src/features/$1",
        "^@tests/(.*)$": "<rootDir>/src/tests/$1",
    },
    // One worker: each spec brings up its own run-scoped stack, and the journeys are written assuming
    // no other spec's traffic interleaves.
    maxWorkers: 1,
    testTimeout: 120_000,
    verbose: true,
    cacheDirectory: path.join(os.tmpdir(),
        "todo-app-e2e-jest-cache"),
}

export = config

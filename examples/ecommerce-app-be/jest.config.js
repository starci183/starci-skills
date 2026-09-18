/** @type {import('jest').Config} */
module.exports = {
  rootDir: '.',
  testEnvironment: 'node',
  roots: ['<rootDir>/apps'],
  transform: {
    // Relative to rootDir on purpose: the alias-parity checker resolves this string against
    // rootDir itself and cannot expand a `<rootDir>` token, so the token form reads as a
    // different TypeScript project than the declared `tsconfig.json` even when it is the same file.
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  testRegex: '.*\\.spec\\.ts$',
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: ['apps/**/*.ts', '!apps/**/*.spec.ts', '!apps/**/main.ts'],
};

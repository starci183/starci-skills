// The child process of `starci app emit` for the operations of one app.
// Prints the OpenAPI 3.1 document of the app's typed operation table on stdout; exit 3 when the app has no `apps/<app>/src/operations.ts`.
// Loads the repository's own typescript (resolved from the repository, never from hfs). Nothing of the repository is executed.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { compilerOptionsOf } from './compiler.mjs';
import { openApiText, operationsPath, readOperations } from './operations.mjs';

const [rootArgument, app] = process.argv.slice(2);
const repoRoot = path.resolve(rootArgument);
const file = path.join(repoRoot, operationsPath(app));
if (!fs.existsSync(file)) process.exit(3);
const ts = createRequire(path.join(repoRoot, 'package.json'))('typescript');
const options = compilerOptionsOf(ts, repoRoot, (message) => process.stderr.write(`stand-in ${message}\n`));
const program = ts.createProgram({ rootNames: [file], options });
try {
  const { operations, components } = readOperations({ ts, program, file });
  process.stdout.write(openApiText({ app, operations, components }));
} catch (error) {
  process.stderr.write(`${error.message}
`);
  process.exit(1);
}

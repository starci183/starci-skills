// The child process of `hfs emit-contracts` for ONE app: `node schema-worker.mjs <repoRoot> <app>`.
// Prints the schema of the app's composed resolvers on stdout; exit 3 when the app composes none (no GraphQL door).
// Loads the repository's own typescript, @nestjs/* and graphql (resolved from the repository, never from hfs).
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { aliasTarget, aliasesOf, appModulePath, importedBindings } from './contracts.mjs';

const [repoRoot, app] = process.argv.slice(2);
const require = createRequire(path.join(repoRoot, 'package.json'));
const ts = require('typescript');
require('reflect-metadata');

// TypeScript behind a `.ts` require hook, with the aliases of tsconfig.json `paths`.
const config = ts.readConfigFile(path.join(repoRoot, 'tsconfig.json'), ts.sys.readFile).config ?? {};
const aliases = aliasesOf(config.compilerOptions?.paths, repoRoot);
const Module = require('node:module');
const resolveFilename = Module._resolveFilename;
Module._resolveFilename = function resolve(request, ...rest) {
  const target = aliasTarget(aliases, request);
  return resolveFilename.call(this, target ?? request, ...rest);
};
require.extensions['.ts'] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true, sourceMap: false },
  });
  module._compile(outputText, filename);
};

// A resolver class: `@Resolver()` watermarks the class as an entry provider, and at least one of its methods is an operation.
const isResolver = (provider) =>
  typeof provider === 'function' &&
  Reflect.getMetadata('__entryProvider__', provider) === true &&
  Object.getOwnPropertyNames(provider.prototype).some((name) => name !== 'constructor' && Reflect.getMetadata('graphql:resolver_type', provider.prototype[name]) !== undefined);

const file = path.join(repoRoot, appModulePath(app));
const scope = createRequire(file);
const resolvers = [];
for (const { name, specifier } of importedBindings(ts, fs.readFileSync(file, 'utf8'))) {
  const target = aliasTarget(aliases, specifier) ?? specifier;
  const exported = scope(target.startsWith('.') || path.isAbsolute(target) ? path.resolve(path.dirname(file), target) : target)[name];
  const providers = typeof exported === 'function' ? Reflect.getMetadata('providers', exported) : undefined;
  if (!Array.isArray(providers)) continue;
  for (const provider of providers) {
    if (isResolver(provider) && !resolvers.includes(provider)) resolvers.push(provider);
  }
}
if (resolvers.length === 0) process.exit(3);

const { NestFactory } = require('@nestjs/core');
const { GraphQLSchemaBuilderModule, GraphQLSchemaFactory } = require('@nestjs/graphql');
const { lexicographicSortSchema, printSchema } = require('graphql');
const context = await NestFactory.createApplicationContext(GraphQLSchemaBuilderModule, { logger: false });
const schema = await context.get(GraphQLSchemaFactory).create(resolvers);
process.stdout.write(printSchema(lexicographicSortSchema(schema)));
await context.close();

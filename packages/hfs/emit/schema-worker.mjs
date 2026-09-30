// The child process of `hfs emit-contracts` for ONE app: `node schema-worker.mjs <repoRoot> <app>`.
// Prints the schema the app serves on stdout; exit 3 when the app's module graph has no GraphQL server.
// Loads the repository's own typescript, @nestjs/* and graphql (resolved from the repository, never from hfs).
//
// Two steps: (1) the module graph of the app root is read from source (static-graph.mjs) and yields the resolver classes the
// GraphQL server would collect; (2) only those classes are loaded, and Nest's own GraphQLSchemaFactory builds the schema.
// Step 2 loads code through the repository's own TypeScript; a dependency of a resolver that cannot load here (configuration
// read at import time, a native addon, an ES-only package; only requires written in the repository's own source) is replaced by a stand-in and reported on stderr, because the
// schema depends on the resolver and type classes, never on what they call. A stand-in that is a GraphQL type fails the build.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { aliasTarget, aliasesOf, appModulePath } from './contracts.mjs';
import { compilerOptionsOf } from './compiler.mjs';
import { createGraphReader } from './static-graph.mjs';

const [rootArgument, app] = process.argv.slice(2);
const repoRoot = path.resolve(rootArgument);
const require = createRequire(path.join(repoRoot, 'package.json'));
const ts = require('typescript');

const config = ts.readConfigFile(path.join(repoRoot, 'tsconfig.json'), ts.sys.readFile).config ?? {};
const aliases = aliasesOf(config.compilerOptions?.paths, repoRoot);

// ---- step 1: the graph, from source ----
const isFile = (candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile();
const host = {
  read: (file) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null),
  resolve(from, specifier) {
    const aliased = aliasTarget(aliases, specifier);
    if (aliased === null && !specifier.startsWith('.')) return null;
    const base = (aliased ?? path.resolve(path.dirname(from), specifier)).replace(/\.js$/, '');
    const found = [base, `${base}.ts`, path.join(base, 'index.ts')].find(isFile);
    if (!found) throw new Error(`${from}: cannot resolve ${specifier}`);
    return found;
  },
};
let composition;
try {
  composition = createGraphReader({ ts, host }).compose(path.join(repoRoot, appModulePath(app)));
} catch (error) {
  process.stderr.write(`${error.message}
`);
  process.exit(1);
}
if (composition === null) process.exit(3);
require('reflect-metadata');

// ---- step 2: the classes, loaded ----
const Module = require('node:module');
const stand = new Proxy(function standIn() {}, {
  get: (_, key) => (key === '__esModule' ? true : key === 'then' ? undefined : key === Symbol.toPrimitive ? () => '' : stand),
  apply: () => stand,
  construct: () => stand,
});
const resolveFilename = Module._resolveFilename;
Module._resolveFilename = function resolve(request, ...rest) {
  return resolveFilename.call(this, aliasTarget(aliases, request) ?? request, ...rest);
};
// The code is compiled the way `tsc` compiles it (a Program over the resolver files and what they import), not file by file:
// `emitDecoratorMetadata` writes the type of a decorated property from the type checker (`facet: Facet` with a string-literal
// union is `String`), which a per-file transpile cannot know and which decides GraphQL field types.
const options = compilerOptionsOf(ts, repoRoot, (message) => process.stderr.write(`stand-in ${message}
`));
const roots = [...composition.resolvers, ...composition.scalars, ...composition.include].map(({ file }) => file);
const program = ts.createProgram({ rootNames: [...new Set(roots)], options });
const compile = (filename) => {
  const sourceFile = program.getSourceFile(filename);
  if (!sourceFile) return ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename, compilerOptions: options }).outputText;
  let output = '';
  program.emit(sourceFile, (name, text) => { if (name.endsWith('.js')) output = text; });
  return output;
};
require.extensions['.ts'] = (module, filename) => module._compile(compile(filename), filename);
let depth = 0;
const load = Module._load;
Module._load = function tolerantLoad(request, parent, isMain) {
  depth += 1;
  try {
    return load.call(this, request, parent, isMain);
  } catch (error) {
    const fromSource = typeof parent?.filename === 'string' && parent.filename.startsWith(repoRoot) && !parent.filename.includes(`${path.sep}node_modules${path.sep}`);
    if (depth === 1 || !fromSource) throw error;
    process.stderr.write(`stand-in ${request} (from ${parent?.filename ?? '?'}): ${String(error?.message ?? error).split('\n')[0]}\n`);
    return stand;
  } finally {
    depth -= 1;
  }
};
const classOf = ({ file, name }) => {
  const exported = require(file)[name];
  if (typeof exported !== 'function') throw new Error(`${file} does not export the class ${name}`);
  return exported;
};

// The packages of the repository under emission, resolved from it (never from hfs, which declares none of them).
const FROM_REPOSITORY = { nestGraphql: '@nestjs/graphql', nestCore: '@nestjs/core', graphql: 'graphql' };
const graphql = require(FROM_REPOSITORY.nestGraphql);
// the constants and the scalar factory are internals of the package: reached by file, its `exports` map hides them
const graphqlDist = path.dirname(require.resolve(FROM_REPOSITORY.nestGraphql));
const { SCALAR_NAME_METADATA, SCALAR_TYPE_METADATA } = require(path.join(graphqlDist, 'graphql.constants.js'));
const { createScalarType } = require(path.join(graphqlDist, 'utils', 'scalar-types.utils.js'));

const resolvers = composition.resolvers.map(classOf);
const scalarsMap = composition.scalars.map(classOf).map((cls) => {
  const typeRef = Reflect.getMetadata(SCALAR_TYPE_METADATA, cls);
  return { type: (typeof typeRef === 'function' && typeRef()) || cls, scalar: createScalarType(Reflect.getMetadata(SCALAR_NAME_METADATA, cls), new cls(...Array.from({ length: cls.length }, () => stand))) };
});
const includeModules = composition.include.map(classOf);

const { NestFactory } = require(FROM_REPOSITORY.nestCore);
const { GraphQLSchemaBuilderModule, GraphQLSchemaFactory } = graphql;
const { lexicographicSortSchema, printSchema } = require(FROM_REPOSITORY.graphql);
const context = await NestFactory.createApplicationContext(GraphQLSchemaBuilderModule, { logger: false });
const schema = await context.get(GraphQLSchemaFactory).create(resolvers, { scalarsMap, includeModules });
process.stdout.write(printSchema(lexicographicSortSchema(schema)));
await context.close();

// docker.mjs - every app builds its own image: be/apps/<app>/Dockerfile and fe/apps/<app>/Dockerfile (slot repo.app-image, required per declared
// app; a Dockerfile anywhere else is owned by no slot) built from the APP ROOT, which holds the one package.json and the managed .dockerignore.
// The Dockerfile is app-owned (hfs scaffold writes it once from templates/<side>/image) and judged here, structurally, from its parsed
// instructions (scripts/lib/dockerfile.mjs), never by matching the text:
//   HFS_DOCKER_BUILD_CONTEXT  the header comment states the app's own build command (`docker build -f <side>/apps/<app>/Dockerfile ... .`, the
//                             context the app root) and no COPY or ADD source leaves the context (`..`, an absolute path)
//   HFS_DOCKER_STAGES         a `build` stage and a last `runtime` stage; the runtime is unprivileged (`USER node`) and runs no build; every install
//                             is `npm ci` (never `npm install`); a back-end runtime installs `--omit=dev --ignore-scripts`, a front-end runtime installs nothing
//   HFS_DOCKER_ENTRY          the runtime starts the app's own built entry (be: node be/dist/apps/<app>/src/main.js; fe: node fe/apps/<app>/server.js); an api or
//                             next app EXPOSEs the PORT it serves and carries a HEALTHCHECK, a worker carries a process HEALTHCHECK, a cli or migrate app
//                             says `HEALTHCHECK NONE` and exposes nothing; a Next app builds `output: "standalone"` and its build runs turbo for its own workspace
//   HFS_DOCKER_BASE_PIN       every FROM is a prior stage, the one node base image of the canon, or an image pinned by digest; never a moving tag
//   HFS_DOCKER_SECRETS        no secret enters an image: no COPY or ADD of an .env file or of .starcistacks, .secrets, a key or a certificate, no ADD of a
//                             URL, no ARG or ENV whose name is a credential (NEXT_PUBLIC_* are published by design and are the one exception)
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findPackage, requirePackage } from '../../lib/package-at.mjs';
import { execForm, parseDockerfile, shellCommands, words } from '../../lib/dockerfile.mjs';
import { found, readText } from './read.mjs';

export const DOCKER_BUILD_CONTEXT = 'HFS_DOCKER_BUILD_CONTEXT';
export const DOCKER_STAGES = 'HFS_DOCKER_STAGES';
export const DOCKER_ENTRY = 'HFS_DOCKER_ENTRY';
export const DOCKER_BASE_PIN = 'HFS_DOCKER_BASE_PIN';
export const DOCKER_SECRETS = 'HFS_DOCKER_SECRETS';

/** The one node base image of every Dockerfile of the canon: an exact node version on an exact alpine release. */
export const NODE_IMAGE = 'node:22.14.0-alpine3.21';
/** The two stages every Dockerfile has: the build, then the runtime that ships. */
export const BUILD_STAGE = 'build';
export const RUNTIME_STAGE = 'runtime';
/** The port a listening app serves unless its environment says otherwise (ENV PORT of the runtime stage). */
export const DEFAULT_PORT = '3000';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BE_KINDS_WITH_LISTENER = new Set(['api']);
const BE_KINDS_ONE_SHOT = new Set(['cli', 'migrate']);
const CREDENTIAL_PARTS = new Set(['PASSWORD', 'PASSWD', 'SECRET', 'SECRETS', 'TOKEN', 'TOKENS', 'KEY', 'KEYS', 'CREDENTIAL', 'CREDENTIALS', 'PRIVATE']);
const SECRET_FOLDERS = new Set(['.starcistacks', '.secrets', '.volume', '.git', '.ssh', '.aws']);
const SECRET_SUFFIXES = ['.key', '.pem', '.p12', '.pfx', '.crt'];
const BUILD_TOOLS = new Set(['tsc', 'tsc-alias', 'next', 'turbo', 'nest', 'webpack', 'vite', 'esbuild']);
const DIGEST = /@sha256:[0-9a-f]{64}$/;

/** The path of the Dockerfile of a be or fe app, app-relative. */
export const dockerfilePath = (side, app) => `${side}/apps/${app}/Dockerfile`;
/** The entry a built be app starts (from the app root). */
export const beEntry = (app) => `be/dist/apps/${app}/src/main.js`;
/** The entry a Next standalone fe app starts (from the app root: the standalone tree keeps the workspace layout). */
export const feEntry = (app) => `fe/apps/${app}/server.js`;

const instructionsOf = (stage, keyword) => stage.instructions.filter((item) => item.keyword === keyword);
/** The commands a stage's RUN instructions run, each as its words (shell form; an exec-form RUN is one command). */
function commandsOf(stage) {
  return instructionsOf(stage, 'RUN').flatMap((run) => {
    const exec = execForm(run.text);
    if (exec) return [{ words: exec, line: run.line }];
    return shellCommands(run.text.replace(/^(?:--\S+\s+)+/, '')).map((parts) => ({ words: parts, line: run.line }));
  });
}
/** `npm ci`, `npm install`, `npm run <script>`, ... as { tool, verb, args }. */
const npmCall = (parts) => (parts[0] === 'npm' ? { verb: parts[1] ?? '', args: parts.slice(2) } : null);
const isBuildCommand = (parts) => {
  const call = npmCall(parts);
  if (call) return call.verb === 'run' && String(call.args[0] ?? '').startsWith('build');
  const tool = parts[0] === 'npx' ? parts[1] : parts[0];
  return BUILD_TOOLS.has(tool);
};

/** The environment `ENV` instructions of a stage set: name -> value (both `ENV A=1 B=2` and `ENV A 1`). */
function envOf(stage) {
  const env = new Map();
  for (const item of instructionsOf(stage, 'ENV')) {
    const parts = words(item.text);
    if (parts.length >= 2 && !parts[0].includes('=')) { env.set(parts[0], parts.slice(1).join(' ')); continue; }
    for (const part of parts) { const at = part.indexOf('='); if (at > 0) env.set(part.slice(0, at), part.slice(at + 1)); }
  }
  return env;
}

/** R172: the header states this app's build command, and the build never reaches outside its context. */
function contextFindings(file, parsed, side, app) {
  const findings = [];
  const wanted = dockerfilePath(side, app);
  const named = parsed.comments.some((comment) => {
    const parts = words(comment.text);
    const build = parts.findIndex((part, index) => part === 'docker' && parts[index + 1] === 'build');
    if (build < 0) return false;
    const flag = parts.indexOf('-f', build);
    return flag > 0 && parts[flag + 1] === wanted && parts.at(-1) === '.';
  });
  if (!named) findings.push(found(DOCKER_BUILD_CONTEXT, file, `${file} does not state its build command in a header comment: \`docker build -f ${wanted} -t <image> .\` (the context is the app root, the folder with the one package.json and lockfile).`, { expected: wanted }));
  for (const item of parsed.instructions.filter((entry) => entry.keyword === 'COPY' || entry.keyword === 'ADD')) {
    const parts = words(item.text).filter((part) => !part.startsWith('--'));
    const sources = parts.slice(0, -1);
    const fromStage = words(item.text).some((part) => part.startsWith('--from='));
    if (fromStage) continue;
    for (const source of sources) {
      if (/^[a-z]+:\/\//i.test(source)) continue;
      const segments = source.split('/');
      if (source.startsWith('/') || segments.includes('..')) findings.push(found(DOCKER_BUILD_CONTEXT, file, `${file}:${item.line} ${item.keyword} source ${source} leaves the build context; every source is a path inside the app root.`, { line: item.line, source }));
    }
  }
  return findings;
}

/** R173: the stages and the install, the user and the build discipline of each. */
function stageFindings(file, parsed, side, kind) {
  const findings = [];
  const { stages } = parsed;
  const names = stages.map((stage) => stage.name);
  if (!names.includes(BUILD_STAGE) || stages.at(-1)?.name !== RUNTIME_STAGE || stages.length < 2) {
    findings.push(found(DOCKER_STAGES, file, `${file} has stages ${JSON.stringify(names)}; an image is multi-stage: a stage named ${BUILD_STAGE} (installs and builds) and a last stage named ${RUNTIME_STAGE} (what ships).`, { stages: names }));
    if (!stages.length) return findings;
  }
  for (const stage of stages) {
    for (const command of commandsOf(stage)) {
      const call = npmCall(command.words);
      if (call && (call.verb === 'install' || call.verb === 'i') && !call.args.some((arg) => arg === '-g' || arg === '--global')) findings.push(found(DOCKER_STAGES, file, `${file}:${command.line} runs \`npm ${call.verb}\`; an image installs with \`npm ci\` from the lockfile.`, { line: command.line }));
    }
  }
  const runtime = stages.at(-1);
  if (runtime.name !== RUNTIME_STAGE) return findings;
  for (const command of commandsOf(runtime)) {
    if (isBuildCommand(command.words)) findings.push(found(DOCKER_STAGES, file, `${file}:${command.line} the ${RUNTIME_STAGE} stage runs the build (\`${command.words.join(' ')}\`); it only receives what the ${BUILD_STAGE} stage built.`, { line: command.line }));
  }
  const users = instructionsOf(runtime, 'USER').map((item) => words(item.text)[0]);
  if (!users.length || users.at(-1) !== 'node') findings.push(found(DOCKER_STAGES, file, `${file} ${RUNTIME_STAGE} stage does not end as \`USER node\` (found ${JSON.stringify(users.at(-1) ?? 'root')}); the process runs unprivileged.`, { user: users.at(-1) ?? 'root' }));
  const installs = commandsOf(runtime).map((command) => ({ call: npmCall(command.words), line: command.line })).filter((entry) => entry.call?.verb === 'ci');
  if (side === 'fe' && installs.length) findings.push(found(DOCKER_STAGES, file, `${file}:${installs[0].line} the ${RUNTIME_STAGE} stage of a Next app installs nothing: it copies the standalone output, which carries its own dependencies.`, { line: installs[0].line }));
  if (side === 'be' && !installs.some((entry) => entry.call.args.includes('--omit=dev') && entry.call.args.includes('--ignore-scripts'))) findings.push(found(DOCKER_STAGES, file, `${file} ${RUNTIME_STAGE} stage does not run \`npm ci --omit=dev --ignore-scripts\`; a back-end runtime holds production dependencies only and runs no lifecycle script.`, { kind }));
  return findings;
}

/** The Next config's `output` property, read with TypeScript's parser: the string literal assigned to `output` in an object literal. */
function nextOutput(ts, text) {
  const source = ts.createSourceFile('next.config.ts', text, ts.ScriptTarget.Latest, true);
  let output = null;
  const visit = (node) => {
    if (ts.isPropertyAssignment(node) && ts.isIdentifier(node.name) && node.name.text === 'output' && ts.isStringLiteralLike(node.initializer)) output = node.initializer.text;
    ts.forEachChild(node, visit);
  };
  visit(source);
  return output;
}

/** R174: the entry, the port and the health of the runtime. */
function entryFindings({ repoRoot, file, parsed, side, app, kind, project, ts }) {
  const findings = [];
  const runtime = parsed.stages.at(-1);
  if (!runtime || runtime.name !== RUNTIME_STAGE) return findings;
  const entry = side === 'be' ? beEntry(app) : feEntry(app);
  const starts = [...instructionsOf(runtime, 'ENTRYPOINT'), ...instructionsOf(runtime, 'CMD')].map((item) => execForm(item.text));
  if (!starts.some((exec) => exec && exec[0] === 'node' && exec[1] === entry)) findings.push(found(DOCKER_ENTRY, file, `${file} ${RUNTIME_STAGE} stage does not start \`["node", "${entry}"]\` in exec form (CMD or ENTRYPOINT); the app runs its own built entry.`, { expected: entry }));
  const exposes = instructionsOf(runtime, 'EXPOSE').flatMap((item) => words(item.text).map((port) => port.replace(/\/(tcp|udp)$/i, '')));
  const health = instructionsOf(runtime, 'HEALTHCHECK').map((item) => words(item.text));
  const none = health.some((parts) => parts[0]?.toUpperCase() === 'NONE');
  const listens = side === 'fe' || BE_KINDS_WITH_LISTENER.has(kind);
  if (listens) {
    const port = envOf(runtime).get('PORT');
    if (!port || !exposes.includes(port)) findings.push(found(DOCKER_ENTRY, file, `${file} ${RUNTIME_STAGE} stage must set \`ENV PORT=<port>\` and \`EXPOSE\` the same port (found PORT ${JSON.stringify(port ?? null)}, EXPOSE ${JSON.stringify(exposes)}); a listening app declares the port it serves.`, { port: port ?? null, exposes }));
    if (!health.length || none) findings.push(found(DOCKER_ENTRY, file, `${file} ${RUNTIME_STAGE} stage has no HEALTHCHECK; an api or Next app answers a health probe the platform can run.`, {}));
  } else if (BE_KINDS_ONE_SHOT.has(kind)) {
    if (!none) findings.push(found(DOCKER_ENTRY, file, `${file} ${RUNTIME_STAGE} stage must say \`HEALTHCHECK NONE\`; a ${kind} app is a one-shot command, not a service.`, { kind }));
    if (exposes.length) findings.push(found(DOCKER_ENTRY, file, `${file} ${RUNTIME_STAGE} stage EXPOSEs ${exposes.join(', ')}; a ${kind} app listens on nothing.`, { exposes }));
  } else {
    if (!health.length || none) findings.push(found(DOCKER_ENTRY, file, `${file} ${RUNTIME_STAGE} stage has no process HEALTHCHECK; a ${kind} app serves nothing, so its healthcheck probes its process.`, { kind }));
    if (exposes.length) findings.push(found(DOCKER_ENTRY, file, `${file} ${RUNTIME_STAGE} stage EXPOSEs ${exposes.join(', ')}; a ${kind} app listens on nothing.`, { exposes }));
  }
  if (side === 'fe') {
    const build = parsed.stages.find((stage) => stage.name === BUILD_STAGE);
    const filter = `--filter=@${project}/${app}`;
    const builds = build && commandsOf(build).some((command) => command.words.includes('turbo') && command.words.includes('build') && command.words.includes(filter));
    if (!builds) findings.push(found(DOCKER_ENTRY, file, `${file} ${BUILD_STAGE} stage does not run \`turbo run build ${filter}\`; a Next image builds its own workspace (and the packages it imports) through turbo.`, { expected: filter }));
    const config = `fe/apps/${app}/next.config.ts`;
    const text = readText(repoRoot, config);
    if (text !== null && ts && nextOutput(ts, text) !== 'standalone') findings.push(found(DOCKER_ENTRY, config, `${config} does not set \`output: "standalone"\`; the runtime stage of ${file} ships the standalone output.`, { expected: 'standalone' }));
  }
  return findings;
}

/** The image reference of a FROM with its build arguments resolved against the ARG defaults before the first FROM; null when one cannot be. */
function resolvedImage(parsed, image) {
  const defaults = new Map();
  for (const item of parsed.preamble.filter((entry) => entry.keyword === 'ARG')) {
    const [name, ...rest] = words(item.text)[0]?.split('=') ?? [];
    if (name && rest.length) defaults.set(name, rest.join('='));
  }
  let unresolved = false;
  const text = image.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}|\$([A-Za-z_][A-Za-z0-9_]*)/g, (whole, braced, bare) => {
    const value = defaults.get(braced ?? bare);
    if (value === undefined) unresolved = true;
    return value ?? whole;
  });
  return unresolved ? null : text;
}

/** R175: every FROM is a prior stage, the canon node image, or an image pinned by digest. */
function pinFindings(file, parsed) {
  const findings = [];
  const earlier = new Set();
  for (const stage of parsed.stages) {
    const image = resolvedImage(parsed, stage.image);
    const ok = image !== null && (earlier.has(image) || image === NODE_IMAGE || DIGEST.test(image));
    if (!ok) findings.push(found(DOCKER_BASE_PIN, file, `${file}:${stage.line} stage ${stage.name ?? stage.index} starts FROM ${stage.image}; the base is ${NODE_IMAGE} (the one node image of the canon), a prior stage, or an image pinned by @sha256 digest. A moving tag changes the image without a change of this file.`, { line: stage.line, image: stage.image, expected: NODE_IMAGE }));
    if (stage.name) earlier.add(stage.name);
  }
  return findings;
}

const isCredentialName = (name) => !name.startsWith('NEXT_PUBLIC_') && name.split('_').some((part) => CREDENTIAL_PARTS.has(part.toUpperCase()));
const isSecretPath = (source) => {
  const segments = source.split('/').filter((part) => part && part !== '.');
  const base = segments.at(-1) ?? '';
  const env = base === '.env' || (base.startsWith('.env.') && base !== '.env.example');
  return env || segments.some((segment) => SECRET_FOLDERS.has(segment)) || SECRET_SUFFIXES.some((suffix) => base.endsWith(suffix)) || base.startsWith('kubeconfig');
};

/** R176: no secret enters an image. */
function secretFindings(file, parsed) {
  const findings = [];
  for (const item of parsed.instructions) {
    if (item.keyword === 'COPY' || item.keyword === 'ADD') {
      const parts = words(item.text);
      if (parts.some((part) => part.startsWith('--from='))) continue;
      const sources = parts.filter((part) => !part.startsWith('--')).slice(0, -1);
      for (const source of sources) {
        if (/^https?:\/\//i.test(source)) findings.push(found(DOCKER_SECRETS, file, `${file}:${item.line} ADD of a URL (${source}); a download is a checksum-verified stage, never an ADD.`, { line: item.line, source }));
        else if (isSecretPath(source)) findings.push(found(DOCKER_SECRETS, file, `${file}:${item.line} ${item.keyword} of ${source}, which holds secret material; credentials are mounted at run time, never copied into an image.`, { line: item.line, source }));
      }
    } else if (item.keyword === 'ARG' || item.keyword === 'ENV') {
      const parts = words(item.text);
      const names = item.keyword === 'ENV' && parts.length >= 2 && !parts[0].includes('=') ? [parts[0]] : parts.map((part) => part.split('=')[0]);
      for (const name of names) if (isCredentialName(name)) findings.push(found(DOCKER_SECRETS, file, `${file}:${item.line} ${item.keyword} ${name} names a credential; an image carries none (an ARG or ENV stays in the image history). Mount it at run time; only NEXT_PUBLIC_* values, which are published by design, are build arguments.`, { line: item.line, name }));
    }
  }
  return findings;
}

/** The TypeScript compiler of the app (else of the runtime), or null. */
function typescriptFor(repoRoot) {
  const located = findPackage([repoRoot, HERE], ['typescript']);
  return located ? requirePackage(located) : null;
}

/** The findings of the docker rules over the tracked paths `files` (app-relative) of the app at `repoRoot`. */
export function dockerFindings({ repoRoot, files, repo }) {
  if (!repo?.sides) return [];
  const tracked = new Set(files);
  const apps = [
    ...repo.sides.be.apps.map((entry) => ({ side: 'be', app: entry.name, kind: entry.kind })),
    ...repo.sides.fe.apps.map((entry) => ({ side: 'fe', app: entry.name, kind: entry.kind })),
  ];
  const ts = apps.some((entry) => entry.side === 'fe') ? typescriptFor(repoRoot) : null;
  return apps.flatMap(({ side, app, kind }) => {
    const file = dockerfilePath(side, app);
    if (!tracked.has(file)) return [];
    const text = readText(repoRoot, file);
    if (text === null) return [found(DOCKER_STAGES, file, `${file} is not readable text.`)];
    const parsed = parseDockerfile(text);
    return [
      ...contextFindings(file, parsed, side, app),
      ...stageFindings(file, parsed, side, kind),
      ...entryFindings({ repoRoot, file, parsed, side, app, kind, project: repo.project, ts }),
      ...pinFindings(file, parsed),
      ...secretFindings(file, parsed),
    ];
  });
}

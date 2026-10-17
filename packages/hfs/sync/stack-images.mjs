// The Swarm deploy images an app declares, as the managed stack-deploy.yml workflow needs them.
//
// The workflow builds one image per `deploy.images` entry of .starcistacks/application-stacks.yaml and hands the pinned references to
// `starci app stack deploy`. Sync renders that list into the workflow, so it reads the declaration here: the union over the declared
// environments of `environments.<env>.deploy.images` (service -> { app, buildArgs }). Only names and the presence of build arguments are
// read; the real validation of the block is stack-deploy-config.mjs (`starci app check`, rule R294). Everything this module returns is
// pure text assembled from names that match the strict patterns below, so no free text reaches the rendered workflow.
import fs from 'node:fs';
import path from 'node:path';
import { parseYaml as bundledParseYaml } from '../runtime/engine/yaml.mjs';
import { DECLARATION } from './sonar-key.mjs';
import { byCodeUnit } from '../report/order.mjs';

const NAME = /^[a-z][a-z0-9-]*$/u;
const KEY = /^[A-Z][A-Z0-9_]*$/u;
const INDENT = ' '.repeat(6);
const CONTINUE = '\\';
const NO_IMAGES_MESSAGE = 'no image is declared: declare environments.<env>.deploy (with images) in .starcistacks/application-stacks.yaml before running this workflow';

const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const hasBuildArgs = args => record(args) && (Object.keys(record(args.values) ? args.values : {}).length > 0 || record(args.sealed));

function environmentImages(environment) {
  const images = environment?.deploy?.images;
  if (!record(images)) return [];
  return Object.entries(images)
    .filter(([service, entry]) => NAME.test(service) && record(entry) && NAME.test(String(entry.app)))
    .map(([service, entry]) => ({ service, app: entry.app, buildArgs: hasBuildArgs(entry.buildArgs) }));
}

/**
 * The images of a parsed declaration, [{ service, app, buildArgs }] sorted by service: the union over its environments (the first
 * environment that names a service decides its app; a later one only adds build arguments). A declaration with no deploy block has none.
 */
function declaredStackImages(declaration) {
  const byService = new Map();
  for (const environment of Object.values(record(declaration?.environments) ? declaration.environments : {})) {
    for (const image of environmentImages(environment)) {
      const known = byService.get(image.service);
      byService.set(image.service, known ? { ...known, buildArgs: known.buildArgs || image.buildArgs } : image);
    }
  }
  return [...byService.values()].sort((a, b) => byCodeUnit(a.service, b.service));
}

/** The host variables (names only) the declared environments interpolate into `docker stack config`: the union of `deploy.passEnv`. */
function declaredPassEnv(declaration) {
  const names = Object.values(record(declaration?.environments) ? declaration.environments : {})
    .flatMap(environment => (Array.isArray(environment?.deploy?.passEnv) ? environment.deploy.passEnv : []))
    .filter(name => typeof name === 'string' && KEY.test(name));
  return [...new Set(names)].sort(byCodeUnit);
}

/** Release builds select the sole image environment, or production on tags and a protected environment input on dispatch. */
function imageEnvironments(declaration) {
  return Object.fromEntries(Object.entries(declaration?.environments ?? {})
    .filter(([name, environment]) => NAME.test(name) && environmentImages(environment).length > 0)
    .map(([name, environment]) => [name, environmentImages(environment).map(image => image.app)]));
}

/**
 * What the managed workflows render from the declaration at `root`: { images, passEnv, imageEnvironments } (empty when the app has no
 * declaration, no deploy block or a declaration that does not parse; `starci app check` judges those). `parseYaml(text)` is injected.
 */
export function readDeclaredStack(root, { parseYaml = bundledParseYaml } = {}) {
  const file = path.join(root, DECLARATION);
  if (!fs.existsSync(file)) return { images: [], passEnv: [] };
  let declaration;
  try {
    declaration = parseYaml(fs.readFileSync(file, 'utf8'));
  } catch {
    return { images: [], passEnv: [] };
  }
  return { images: declaredStackImages(declaration), passEnv: declaredPassEnv(declaration), imageEnvironments: imageEnvironments(declaration) };
}

const envName = service => `IMAGE_${service.toUpperCase().replaceAll('-', '_')}`;
/** Lines placed at the end of a template line: each one starts with a newline, so nothing declared leaves nothing, not even a blank line. */
const block = (items, indent = INDENT) => items.map(item => `\n${indent}${item}`).join('');

function buildArgsStep(image) {
  return [
    `- name: public build values of ${image.service}`,
    `  id: args-${image.service}`,
    '  env:',
    '    SOPS_AGE_KEY: ${{ secrets.SOPS_AGE_KEY }}',
    `  run: npx --no-install starci app stack build-args --env "$STACK_ENVIRONMENT" --app ${image.app}`,
  ];
}

function buildPushStep(image, dockerfile) {
  return [
    `- name: build and push ${image.service}`,
    `  id: build-${image.service}`,
    '  uses: docker/build-push-action@10e90e3645eae34f1e60eeb005ba3a3d33f178e8 # v6.19.2',
    '  with:',
    '    context: .',
    `    file: ${dockerfile}`,
    '    push: true',
    '    provenance: false',
    `    tags: \${{ steps.names.outputs.${image.service} }}:\${{ github.sha }}`,
    ...(image.buildArgs ? [`    build-args: \${{ steps.args-${image.service}.outputs.args }}`] : []),
    `    cache-from: type=gha,scope=${image.service}`,
    `    cache-to: type=gha,scope=${image.service},mode=max`,
  ];
}

/**
 * The text blocks the stack-deploy.yml template places at the end of a line (each already indented for its position, every line led by
 * a newline; empty when there is nothing to place):
 *   stackGuard       the first step of the release job when the app declares no image (it fails with the reason)
 *   stackNames       the `names` step lines assigning each image repository (ghcr.io/<lowercase owner>/<project>-<app>)
 *   stackImageSteps  per image: the optional build-args step and the build-and-push step
 *   stackImageEnv    the env entries of the deploy step: IMAGE_<SERVICE> = repository@digest
 *   stackImageArgs   the `--image "<service>=$IMAGE_<SERVICE>" \` continuation lines of the deploy command
 *   stackPassEnv     the env entries of the deploy step for the declared host variables (vars.<NAME>)
 * `dockerfileOf(app)` names the Dockerfile of an app (the sync module knows the layout).
 */
export function stackWorkflowVariables({ images = [], passEnv = [], imageEnvironments: environments = {} }, project, dockerfileOf) {
  const guard = images.length ? '' : block([
    '- name: require a declared image',
    '  shell: bash',
    `  run: 'echo "::error::${NO_IMAGES_MESSAGE}"; exit 1'`,
  ]);
  const names = images.map(image => `echo "${image.service}=ghcr.io/\${owner}/${project}-${image.app}" >> "$GITHUB_OUTPUT"`);
  return {
    ...releaseImageVariables(environments),
    stackGuard: guard,
    stackNames: block(names, ' '.repeat(10)),
    stackImageSteps: images.map(image => block([...(image.buildArgs ? buildArgsStep(image) : []), ...buildPushStep(image, dockerfileOf(image.app))])).join(''),
    stackImageEnv: block(images.map(image => `${envName(image.service)}: \${{ steps.names.outputs.${image.service} }}@\${{ steps.build-${image.service}.outputs.digest }}`), ' '.repeat(10)),
    stackImageArgs: block(images.map(image => `--image "${image.service}=$${envName(image.service)}" ${CONTINUE}`), ' '.repeat(12)),
    stackPassEnv: block(passEnv.map(name => `${name}: \${{ vars.${name} }}`), ' '.repeat(10)),
  };
}

/** The matrix uses the deploy verb only for apps the selected environment deploys; undeployed images retain Dockerfile defaults. */
function releaseImageVariables(environments) {
  const names = Object.keys(environments);
  const selectedApp = names.map(name => `(env.STACK_ENVIRONMENT == '${name}' && contains(fromJSON('${JSON.stringify(environments[name])}'), matrix.name))`).join(' || ') || 'false';
  const multiple = names.length > 1;
  const environment = multiple ? "${{ github.event_name == 'workflow_dispatch' && inputs.environment || 'production' }}" : names[0] ?? 'production';
  const dispatch = multiple ? [
    '  workflow_dispatch:',
    '    inputs:',
    '      environment:',
    '        description: Environment whose public build values the release images use',
    '        required: true',
    '        type: environment',
    '        default: production',
  ].join('\n') : '  workflow_dispatch: {}';
  return {
    imageDispatch: dispatch,
    imageEnvironment: environment,
    imageJobEnvironment: names.length ? `\n    environment: ${environment}` : '',
    imageEnvironmentGuard: multiple ? block([
      '- name: require a declared image environment',
      `  if: \${{ !contains(fromJSON('${JSON.stringify(names)}'), env.STACK_ENVIRONMENT) }}`,
      '  run: \'echo "::error::STACKS_DEPLOY_ENV_UNKNOWN: selected environment declares no deploy images"; exit 1\'',
    ]) : '',
    imageBuildArgsIf: `\${{ ${selectedApp} }}`,
  };
}

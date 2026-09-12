import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import { skillRoot } from '../core/runtime-root.mjs';
import { parseYaml } from '../core/yaml.mjs';
export const configRoot = skillRoot;
/** `supervisor` and `validator` share one shape: `{runtimes: [id, ...]}`, a nonempty list of runtime ids and nothing else. */
const runtimesOk = section => section === undefined || (section && typeof section === 'object' && !Array.isArray(section) && Object.keys(section).every(key => key === 'runtimes') && Array.isArray(section.runtimes) && section.runtimes.length > 0 && section.runtimes.every(item => typeof item === 'string' && item.trim()));
export function validateConfig(config) {
  if (!config || Array.isArray(config) || Object.keys(config).some(key => !['language','model','effort','supervisor','validator'].includes(key)) || !runtimesOk(config.supervisor) || !runtimesOk(config.validator) || typeof config.language !== 'string' || !/^[a-z]{2,3}(?:-[A-Za-z0-9]+)*$/.test(config.language) || !(config.model === null || typeof config.model === 'string' && config.model.trim()) || !['none','minimal','low','medium','high','xhigh','max','ultra'].includes(config.effort)) throw Error('Invalid config.json: expected language, model (null or host model name), effort, and optionally supervisor.runtimes / validator.runtimes (nonempty lists of runtime ids).');
  return config;
}
/** Resolve the authored/legacy example under a skill root. Prefer YAML; accept JSON; then built `.dist` JSON. */
function readExample(root = configRoot) {
  const yaml = path.join(root, 'config.example.yaml');
  if (fs.existsSync(yaml)) return validateConfig(parseYaml(fs.readFileSync(yaml, 'utf8')));
  const json = path.join(root, 'config.example.json');
  if (fs.existsSync(json)) return validateConfig(JSON.parse(fs.readFileSync(json, 'utf8')));
  const fromDist = path.join(root, '.dist', 'config.example.json');
  if (fs.existsSync(fromDist)) return validateConfig(JSON.parse(fs.readFileSync(fromDist, 'utf8')));
  throw Error('Missing config.example.yaml (or legacy config.example.json)');
}
export function loadConfig(root = configRoot, {initialize = false} = {}) {
  const file = path.join(root, 'config.json');
  if (initialize && !fs.existsSync(file)) {
    const example = readExample(root);
    try { fs.writeFileSync(file, JSON.stringify(example, null, 2) + '\n', {flag:'wx'}); } catch(error) { if(error.code !== 'EEXIST') throw error; }
  }
  if (fs.existsSync(file)) return validateConfig(JSON.parse(fs.readFileSync(file, 'utf8')));
  return readExample(root);
}
if(process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.stdout.write(JSON.stringify(loadConfig(configRoot,{initialize:true}))+'\n'); }
  catch(error) { process.stderr.write(error.message+'\n'); process.exitCode=1; }
}

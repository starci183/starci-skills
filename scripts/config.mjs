import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export const configRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export function validateConfig(config) {
  if (!config || Array.isArray(config) || Object.keys(config).some(key => !['language','model','effort'].includes(key)) || typeof config.language !== 'string' || !/^[a-z]{2,3}(?:-[A-Za-z0-9]+)*$/.test(config.language) || !(config.model === null || typeof config.model === 'string' && config.model.trim()) || !['none','minimal','low','medium','high','xhigh','max','ultra'].includes(config.effort)) throw Error('Invalid config.json: expected language, model (null or host model name), and effort.');
  return config;
}
export function loadConfig(root = configRoot, {initialize = false} = {}) {
  const file = path.join(root, 'config.json');
  if (initialize && !fs.existsSync(file)) {
    const example = validateConfig(JSON.parse(fs.readFileSync(path.join(root, 'config.example.json'), 'utf8')));
    try { fs.writeFileSync(file, JSON.stringify(example, null, 2) + '\n', {flag:'wx'}); } catch(error) { if(error.code !== 'EEXIST') throw error; }
  }
  return validateConfig(JSON.parse(fs.readFileSync(fs.existsSync(file) ? file : path.join(root,'config.example.json'), 'utf8')));
}
if(process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.stdout.write(JSON.stringify(loadConfig(configRoot,{initialize:true}))+'\n'); }
  catch(error) { process.stderr.write(error.message+'\n'); process.exitCode=1; }
}

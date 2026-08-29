import fs from 'node:fs';
import { validatorFor } from '../operators/validation.mjs';

const validate = validatorFor(new URL('./config.schema.json', import.meta.url));
export function loadRuntimeConfig(file = new URL('../config.yaml', import.meta.url)) {
  const text = fs.readFileSync(file, 'utf8');
  const value = Object.fromEntries(text.split(/\r?\n/).filter(Boolean).map((line) => {
    const [key, ...rest] = line.split(':'); const raw = rest.join(':').trim();
    return [key.trim(), raw === 'true' ? true : raw === 'false' ? false : raw];
  }));
  const result = validate(value); if (!result.valid) throw new Error(result.errors.join('; '));
  return Object.freeze(value);
}

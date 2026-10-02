// protected-installations.mjs - load the one data contract for host installations runtime actions must not mutate.
import fs from 'node:fs';
import path from 'node:path';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { parseYaml } from '../../engine/yaml.mjs';

export const PROTECTED_INSTALLATIONS_FILE = 'modules/host/protected-installations.yaml';
const SCHEMA = 'starci/protected-installations@1';

const validPort = (value) => Number.isInteger(value) && value > 0 && value <= 65_535;

/** Load and minimally validate the protected-installations contract. */
export function loadProtectedInstallations({ root = skillRoot, readFile = (file) => fs.readFileSync(file, 'utf8') } = {}) {
  const file = path.join(root, ...PROTECTED_INSTALLATIONS_FILE.split('/'));
  const document = parseYaml(readFile(file));
  if (document?.schema !== SCHEMA) throw new Error(`${PROTECTED_INSTALLATIONS_FILE} must carry schema ${SCHEMA}`);
  const containerMarkers = document.containerMarkers;
  const list = document.ports?.list;
  const ranges = document.ports?.ranges;
  if (!Array.isArray(containerMarkers) || !containerMarkers.length || containerMarkers.some((value) => typeof value !== 'string' || !value.trim())) {
    throw new Error(`${PROTECTED_INSTALLATIONS_FILE} containerMarkers must be a non-empty string list`);
  }
  if (!Array.isArray(list) || list.some((value) => !validPort(value))) {
    throw new Error(`${PROTECTED_INSTALLATIONS_FILE} ports.list must contain valid host ports`);
  }
  if (!Array.isArray(ranges) || ranges.some((range) => !validPort(range?.first) || !validPort(range?.last) || range.first > range.last)) {
    throw new Error(`${PROTECTED_INSTALLATIONS_FILE} ports.ranges must contain ordered host-port ranges`);
  }
  return Object.freeze({
    schema: SCHEMA,
    containerMarkers: Object.freeze(containerMarkers.map((value) => value.toLowerCase())),
    ports: Object.freeze({ list: Object.freeze([...list]), ranges: Object.freeze(ranges.map((range) => Object.freeze({ ...range }))) }),
  });
}

const PROTECTED = loadProtectedInstallations();

/** Whether a container or project name carries a protected installation marker. */
export const isProtectedContainer = (value, contract = PROTECTED) => {
  const name = String(value ?? '').toLowerCase();
  return contract.containerMarkers.some((marker) => name.includes(marker));
};

/** The protected port label matched by a host port, or null when the port is available to policy. */
export const protectedPortLabel = (value, contract = PROTECTED) => {
  const port = Number(value);
  if (contract.ports.list.includes(port)) return String(port);
  const range = contract.ports.ranges.find(({ first, last }) => port >= first && port <= last);
  return range ? `${range.first}-${range.last}` : null;
};

export const isProtectedPort = (value, contract = PROTECTED) => protectedPortLabel(value, contract) !== null;

/** Protected port numbers mentioned as whole numeric tokens in text, in first-seen order. */
export function protectedPortsInText(value, contract = PROTECTED) {
  return [...new Set([...String(value ?? '').matchAll(/\b\d{1,5}\b/gu)]
    .map((match) => Number(match[0])).filter((port) => isProtectedPort(port, contract)))];
}

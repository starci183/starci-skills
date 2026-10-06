const LINE_TERMINATORS = ['\n', '\r', '\u2028', '\u2029'];
const VALUE_EXTENSIONS = ['env', 'key', 'pem', 'tfvars'];

/** The filenames matched by the declaration's former `INFRA_VALUE_FILE` expression. */
export const isInfrastructureValueFile = (value) => {
  const name = String(value);
  if (LINE_TERMINATORS.some((line) => name.includes(line))) return false;
  if (name === '.env' || (name.startsWith('.env.') && name.length > '.env.'.length)) return true;
  for (let dot = name.indexOf('.', 1); dot !== -1; dot = name.indexOf('.', dot + 1)) {
    for (const extension of VALUE_EXTENSIONS) {
      if (!name.startsWith(extension, dot + 1)) continue;
      const after = dot + 1 + extension.length;
      if (after === name.length || (name[after] === '.' && after + 1 < name.length)) return true;
    }
  }
  return false;
};

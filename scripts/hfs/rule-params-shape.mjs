// rule-params-shape.mjs - the shape of `ruleParams` of an app slot manifest (knowledge/hfs/slots.yaml): the parameters both sides
// share (`common`), the back end's own (`be`) and the front end's overrides (`fe`). Pure: a parsed manifest in, a list of
// problems out, in the words of modules/schemas/hfs-slots.schema.yaml. scripts/hfs/slots.mjs (loadSlotManifest) is the reader.
import { isPlainObject } from '../../engine/plain-object.mjs';
import { paramNamesOk } from './param-names.mjs';
import { kindParamProblems, scenarioProblem } from './declaration-slots.mjs';
import { roleListProblems, unitRolesProblems } from './manifest-shape.mjs';

const PROFILES = ['be', 'fe'];

/** The shape problems of `m.ruleParams`. */
export function ruleParamsProblems(m) {
  const bad = [];
  const blockOk = (v) => isPlainObject(v) && Number.isInteger(v.lines) && v.lines >= 2 && Number.isInteger(v.tokens) && v.tokens >= 1 && Object.keys(v).length === 2;
  const fileLinesOk = (v) => isPlainObject(v) && Number.isInteger(v.soft) && v.soft >= 1 && typeof v.hardGrowth === 'boolean' && Object.keys(v).length === 2;
  const rp = m.ruleParams;
  if (!isPlainObject(rp) || Object.keys(rp).some((k) => ![...PROFILES, 'common'].includes(k)) || !isPlainObject(rp.common) || !isPlainObject(rp.be) || (rp.fe !== undefined && !isPlainObject(rp.fe))) bad.push('ruleParams must be a map with common, be and optionally fe');
  else {
    // common holds the parameters both sides share; a side may restate one of them (a valid value) as an override, nothing else.
    const sharedParam = (key, v) => (key === 'fileLines' ? fileLinesOk(v) : blockOk(v));
    const sideOk = (side, own) => own.every((k) => side[k] !== undefined) && Object.entries(side).every(([k, v]) => own.includes(k) || (['fileLines', 'duplicateBlock'].includes(k) && sharedParam(k, v)));
    if (Object.keys(rp.common).length !== 2 || !fileLinesOk(rp.common.fileLines) || !blockOk(rp.common.duplicateBlock)) bad.push('ruleParams.common needs exactly fileLines {soft, hardGrowth} and duplicateBlock {lines >= 2, tokens >= 1}');
    if (!sideOk(rp.be, ['infraOwners', 'eventBus', 'specDoubles', 'paramNames', 'suffixes', 'bannedSuffixes', 'contractShape', 'unitRoles', 'logicRoles', 'thinRoles', 'patternScenarios', 'kindPatterns', 'addKinds'])) bad.push('ruleParams.be needs infraOwners, eventBus, specDoubles, paramNames, suffixes, bannedSuffixes, contractShape {helper}, unitRoles, logicRoles, thinRoles, patternScenarios, kindPatterns and addKinds (fileLines and duplicateBlock live in ruleParams.common, a side may override them)'); else bad.push(...unitRolesProblems(rp.be), ...roleListProblems(rp.be));
    bad.push(...scenarioProblem(rp.be.patternScenarios), ...kindParamProblems(rp.be, m.triggerKinds));
    if (!isPlainObject(rp.be.contractShape) || Object.keys(rp.be.contractShape).length !== 1 || !/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(String(rp.be.contractShape.helper))) bad.push('ruleParams.be.contractShape must be {helper: <identifier>}');
    const owners = rp.be.infraOwners;
    const ownerId = /^(platform|integrations)\/[a-z][a-z0-9-]*$/;
    if (!isPlainObject(owners) || !Object.keys(owners).length || !Object.entries(owners).every(([key, list]) => key && Array.isArray(list) && list.every((o) => ownerId.test(String(o))) && new Set(list).size === list.length)) bad.push('ruleParams.be.infraOwners must map a non-empty specifier to a list of unique platform/<capability> or integrations/<provider> owners ([] means nowhere)');
    const className = /^[A-Z][A-Za-z0-9]*$/;
    const memberMap = (v, allowEmpty) => isPlainObject(v) && Object.keys(v).length > 0 && Object.values(v).every((list) => Array.isArray(list) && (allowEmpty || list.length > 0) && list.every((x) => className.test(String(x))) && new Set(list).size === list.length);
    const eventBus = rp.be.eventBus;
    if (!isPlainObject(eventBus) || Object.keys(eventBus).sort().join() !== 'classes,imports' || !memberMap(eventBus.imports, true) || !memberMap(eventBus.classes, false)) bad.push('ruleParams.be.eventBus must be {imports: {<module>: [unique PascalCase members]}, classes: {<module>: [non-empty unique PascalCase classes]}}');
    if (!paramNamesOk(rp.be.paramNames)) bad.push('ruleParams.be.paramNames must be a non-empty list of unique {type | typeSuffix, names, nameSuffix?} entries');
    const roleList = (v) => Array.isArray(v) && v.length > 0 && v.every((x) => /^[a-z][a-z0-9-]*$/.test(String(x))) && new Set(v).size === v.length;
    if (!roleList(rp.be.suffixes)) bad.push('ruleParams.be.suffixes must be a non-empty list of unique kebab-case role suffixes');
    if (!roleList(rp.be.bannedSuffixes)) bad.push('ruleParams.be.bannedSuffixes must be a non-empty list of unique kebab-case suffixes');
    else if (roleList(rp.be.suffixes) && rp.be.suffixes.some((x) => rp.be.bannedSuffixes.includes(x))) bad.push('ruleParams.be.suffixes and bannedSuffixes must be disjoint');
    const formNames = ['call', 'new', 'curried', 'object', 'primitive', 'array'];
    const formsOk = (v) => Array.isArray(v) && v.length > 0 && v.every((x) => formNames.includes(x)) && new Set(v).size === v.length;
    const doubleOk = (v) => isPlainObject(v) && /^[A-Za-z][A-Za-z0-9]*$/.test(String(v.double)) && formsOk(v.forms);
    const regexOk = (v) => { try { return typeof v === 'string' && v.length > 0 && Boolean(new RegExp(v)); } catch { return false; } };
    const sd = rp.be.specDoubles;
    if (!isPlainObject(sd) || Object.keys(sd).sort().join() !== 'doubles,fallback,kit' || typeof sd.kit !== 'string' || !sd.kit || !Array.isArray(sd.doubles) || !sd.doubles.length || !sd.doubles.every((e) => doubleOk(e) && regexOk(e.token) && Object.keys(e).length === 3) || !doubleOk(sd.fallback) || Object.keys(sd.fallback).length !== 2) bad.push('ruleParams.be.specDoubles must be {kit, doubles: [{token: regex, double, forms}], fallback: {double, forms}} with forms drawn from call, new, curried, object, primitive, array');
    if (rp.fe !== undefined && !sideOk(rp.fe, [])) bad.push('ruleParams.fe may only restate fileLines and duplicateBlock of ruleParams.common');
  }
  return bad;
}

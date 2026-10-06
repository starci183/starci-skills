// fe-contract-documents.mjs - FE_GRAPHQL_CONTRACT (R113): every GraphQL document a front end sends is one its back end
// serves. An app keeps the contract of each GraphQL service it runs as a snapshot, `be/contracts/<service>/schema.graphql`
// (`starci app emit`, HFS_CONTRACT_SNAPSHOT_DRIFT keeps it current), and its front end keeps every operation it sends
// in a `.graphql` file under `fe/`. Each operation is judged against the contract of the service that serves its first
// root field (the one snapshot whose root type declares it): a root field no contract declares, a field, argument or input
// field the contract does not declare, a required argument left out, a variable of another type, a leaf with a selection or
// an object without one is a finding on the document. The finding names the service and every problem.
import { operationProblems, parseDocument, parseSchema, rootFieldsOf } from '../../lib/graphql-contract.mjs';
import { found, readText } from './read.mjs';
import { byCodeUnit } from '../../lib/list.mjs';

export const FE_GRAPHQL_CONTRACT = 'FE_GRAPHQL_CONTRACT';

const CONTRACT = /^be\/contracts\/([^/]+)\/schema\.graphql$/;
const isDocument = (file) => file.startsWith('fe/') && file.endsWith('.graphql') && !file.includes('/__generated__/') && !file.includes('/node_modules/');

/** The parsed contracts of the app: [{ service, path, schema }], or a finding for a snapshot that does not parse. */
function contractsOf(repoRoot, files, findings) {
  const contracts = [];
  for (const file of files) {
    const match = CONTRACT.exec(file);
    if (!match) continue;
    const text = readText(repoRoot, file);
    if (text === null) continue;
    try {
      contracts.push({ service: match[1], path: file, schema: parseSchema(text) });
    } catch (error) {
      findings.push(found(FE_GRAPHQL_CONTRACT, file, `${file} is not a GraphQL schema the front-end documents can be judged against: ${error.message}. Run \`npm run contract:emit\`.`));
    }
  }
  return contracts;
}

/** The findings of R113 over the tracked paths `files` of the app at `repoRoot`. */
export function feContractFindings({ repoRoot, files }) {
  const documents = files.filter(isDocument).sort(byCodeUnit);
  if (documents.length === 0) return [];
  const findings = [];
  const contracts = contractsOf(repoRoot, files, findings);
  for (const file of documents) {
    const text = readText(repoRoot, file);
    if (text === null) continue;
    let document;
    try {
      document = parseDocument(text);
    } catch (error) {
      findings.push(found(FE_GRAPHQL_CONTRACT, file, `${file} is not a GraphQL document: ${error.message}.`));
      continue;
    }
    for (const operation of document.operations) {
      const label = operation.name ?? `anonymous ${operation.operation}`;
      const [first] = rootFieldsOf(operation);
      const serving = contracts.filter(({ schema }) => schema.types.get(schema.roots[operation.operation])?.fields?.has(first));
      if (serving.length === 0) {
        const where = contracts.length === 0 ? 'the app keeps no be/contracts/<service>/schema.graphql' : `no contract of ${contracts.map((c) => c.path).join(', ')} declares ${operation.operation} ${first}`;
        findings.push(found(FE_GRAPHQL_CONTRACT, file, `${file}: ${label} asks ${operation.operation} ${first}, but ${where}; the front end sends only what a back end serves.`, { operation: label, service: null }));
        continue;
      }
      const [contract] = serving;
      const problems = operationProblems(contract.schema, document, operation);
      if (problems.length > 0) {
        findings.push(found(FE_GRAPHQL_CONTRACT, file, `${file}: ${label} does not match the ${contract.service} contract (${contract.path}): ${problems.join('; ')}.`, { operation: label, service: contract.service, problems }));
      }
    }
  }
  return findings;
}

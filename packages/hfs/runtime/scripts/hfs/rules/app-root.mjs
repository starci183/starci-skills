// app-root.mjs - the tree checks of `hfs check` that read the WHOLE app from its root (app-relative paths over every tracked
// file of both sides): one list of the rule modules of the app root, so scripts/hfs/check.mjs runs them as one step.
//   HFS_DEP_VERSION_SKEW (R14, deps.mjs), HFS_PEER_INTEGRATION_MISSING (R111, peer-integrations.mjs), the monorepo shape
//   (HFS_MONO_*, monorepo.mjs), the one cli app (BE_CLI_REQUIRED, cli.mjs), BE_INTEGRATION_SPEC_MISSING (R112,
//   integration-specs.mjs), FE_GRAPHQL_CONTRACT (R113, fe-contract-documents.mjs), HFS_CI_MISSING_CANON (R13, pipeline.mjs),
//   BE_TEST_TOPOLOGY (R47, test-topology.mjs), HFS_PROOF_COMMAND_FILE_MISSING (R105, proof-commands.mjs), the app front-end
//   tree (FE_WIRE_GENERATED, FE_I18N_PLACEMENT, frontend-tree.mjs) and HFS_STACKS_SHAPE (R10, stacks.mjs).
import { cliFindings } from './cli.mjs';
import { contractCompatFindings } from './contract-compat.mjs';
import { depFindings } from './deps.mjs';
import { eventClassContractFindings, patternSpecFindings } from './event-bus.mjs';
import { feContractFindings } from './fe-contract-documents.mjs';
import { appFrontendFindings } from './frontend-tree.mjs';
import { integrationSpecFindings } from './integration-specs.mjs';
import { kindFindings } from './kinds.mjs';
import { monorepoFindings } from './monorepo.mjs';
import { peerIntegrationFindings } from './peer-integrations.mjs';
import { pipelineFindings } from './pipeline.mjs';
import { proofCommandFindings } from './proof-commands.mjs';
import { sagaFindings } from './saga.mjs';
import { serviceFindings } from './services.mjs';
import { stacksFindings } from './stacks.mjs';
import { testTopologyFindings } from './test-topology.mjs';

/**
 * The findings of the app-root rules: `files` are the root's own tracked paths, `all` every tracked path of the app, `repo` the
 * resolved app declaration, `resolver` its slot resolver and `pins` the canon pins.
 */
export function appRootFindings({ repoRoot, files, all, repo, resolver, pins }) {
  return [
    ...depFindings({ repoRoot, files: all }),
    ...peerIntegrationFindings({ repoRoot, files: all }),
    ...monorepoFindings({ repoRoot, files: all, repo }),
    ...cliFindings({ files: all, repo, resolver }),
    ...contractCompatFindings({ repoRoot, files: all }),
    ...eventClassContractFindings({ repoRoot, files: all, repo }),
    ...patternSpecFindings({ repoRoot, files: all, repo }),
    ...serviceFindings({ repoRoot, files: all, repo }),
    ...sagaFindings({ repoRoot, files: all }),
    ...kindFindings({ files: all, repo }),
    ...integrationSpecFindings({ repoRoot, files: all }),
    ...feContractFindings({ repoRoot, files: all }),
    ...pipelineFindings({ repoRoot, files, pins }),
    ...testTopologyFindings({ repoRoot, files }),
    ...proofCommandFindings({ repoRoot, files: all, resolver, sides: Object.keys(repo.sides ?? {}) }),
    ...appFrontendFindings({ repoRoot, files: all, repo }),
    ...stacksFindings({ repoRoot, files, resolver }),
  ];
}

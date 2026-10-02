// repository-rules.mjs - the tree-rule findings `hfs check` runs over the tracked files of one app: the monorepo shape (R127-R130), the event
// contract of the bounded contexts (R157), the typed event classes and the pattern proof scenarios (R131, R135), the trigger kinds (R159, R160), the integration specs (R112),
// the front-end GraphQL documents (R113), the microservice policy (R143-R147) and the saga canon (R149-R153). One place composes them, so
// check.mjs does not grow with every rule family.
import { contractCompatFindings } from './contract-compat.mjs';
import { eventClassContractFindings, patternSpecFindings } from './event-bus.mjs';
import { feContractFindings } from './fe-contract-documents.mjs';
import { integrationSpecFindings } from './integration-specs.mjs';
import { kindFindings } from './kinds.mjs';
import { monorepoFindings } from './monorepo.mjs';
import { sagaFindings } from './saga.mjs';
import { serviceFindings } from './services.mjs';

/** The findings of every rule family that reads the tracked files `files` of the app `repo` rooted at `repoRoot`. */
export function repositoryRuleFindings({ repoRoot, files, repo }) {
  return [
    ...monorepoFindings({ repoRoot, files, repo }),
    ...contractCompatFindings({ repoRoot, files }),
    ...eventClassContractFindings({ repoRoot, files, repo }),
    ...patternSpecFindings({ repoRoot, files, repo }),
    ...kindFindings({ files, repo }),
    ...integrationSpecFindings({ repoRoot, files }),
    ...feContractFindings({ repoRoot, files }),
    ...serviceFindings({ repoRoot, files, repo }),
    ...sagaFindings({ repoRoot, files }),
  ];
}

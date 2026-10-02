// repository-rules.mjs - the tree-rule findings `hfs check` runs over the tracked files of one app: the monorepo shape (R128-R131), the event
// contract of the bounded contexts (R162), the typed event classes and the pattern proof scenarios (R136, R140), the trigger kinds (R164, R165), the integration specs (R112),
// the front-end GraphQL documents (R113), the microservice policy (R148-R152) and the saga canon (R154-R158). One place composes them, so
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

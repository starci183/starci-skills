// runtime-deploy-codes.mjs - the failure codes of `starci runtime deploy` (catalogued in modules/kernel/failure-codes.yaml), and the shape of one refusal.
export const DEPLOY = Object.freeze({
  sourceUnresolved: { code: 'deploy-source-unresolved' },
  sourceDirty: { code: 'deploy-source-dirty' },
  hostDirty: { code: 'deploy-host-dirty' },
  hostNotMain: { code: 'deploy-host-not-main' },
  notFastForward: { code: 'deploy-not-fast-forward' },
  checkRed: { code: 'deploy-check-red' },
  affectedRed: { code: 'deploy-affected-red' },
  checkUnproven: { code: 'deploy-check-unproven' },
  releaseCutRunning: { code: 'deploy-release-cut-running' },
  hostLockHeld: { code: 'deploy-host-lock-held' },
  inFlight: { code: 'deploy-in-flight' },
  migrationFailed: { code: 'deploy-artefact-migration-failed' },
  restartFailed: { code: 'deploy-restart-failed' },
  verifyFailed: { code: 'deploy-verify-failed' },
  uiInstallFailed: { code: 'deploy-ui-install-failed' },
});

/** A refusal or failure: the catalogued code and what the person needs to read. */
export const refusal = (kind, detail) => ({ code: kind.code, detail });

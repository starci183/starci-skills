/** Project issues from available rendered deployments with the caller's finding factory. */
export function deploymentFindings(deployments, issuesFor, findingFor, defaultFile) {
  return deployments.filter(entry => !entry.unavailable).flatMap(entry => {
    const file = entry.file ?? defaultFile;
    return issuesFor(entry).map(issue => findingFor(issue.code, file, `${file}: ${issue.at}: ${issue.message}`));
  });
}

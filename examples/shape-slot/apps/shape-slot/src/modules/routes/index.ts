/** Href of a module of a workspace (the module bar). */
export const moduleHref = (workspaceId: string, module: string) => `/${workspaceId}/${module}`

/** Href of the operate page of one handoff. */
export const operateHref = (workspaceId: string, handoffId: string) => `/${workspaceId}/operate/${handoffId}`

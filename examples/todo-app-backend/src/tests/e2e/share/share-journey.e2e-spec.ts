import {
    E2EWorld, bootE2EWorld 
} from "@tests/infra/e2e-world"
import {
    E2E_BOOT_TIMEOUT_MS 
} from "@tests/infra/testing-infra.options"
import {
    GraphqlObserved 
} from "@tests/infra/integrations/http/e2e-http.service"

jest.setTimeout(120_000)

/**
 * fr.share.* as one A->Z journey over the run-owned stack: the owner invites a collaborator, who
 * before accepting is a stranger (sees nothing, cannot touch the task); on accept the editor role
 * is live in the same call (CollaboratorCache binds at write time), so the collaborator sees the
 * invitation and completes the owner's task; on revoke the cache entry is deleted in the same call
 * that flips the row, so the very next transition attempt is refused -- br.share.revoke.on-read's
 * "immediately, not by a sweep". The Postgres read at the end is out-of-band verification only.
 */

const RUN = `e2e-share-${Date.now().toString(36)}`

interface Invitation {
  invitationId: string;
  email: string;
  role: string;
  status: string;
}

describe("share journey (e2e)",
    () => {
        let world: E2EWorld

        beforeAll(async () => {
            world = await bootE2EWorld()
            expect(
                (await world.http.anonymous().get<{ status: string }>("/health")).data.status,
            ).toBe("ok")
        },
        E2E_BOOT_TIMEOUT_MS)

        afterAll(async () => {
            await world.moduleRef.close()
        })

        const dataOf = <TData, K extends keyof TData>(
            observed: GraphqlObserved<TData>,
            operation: K,
        ): NonNullable<TData[K]> => {
            const data = observed.data?.[operation]
            if (data === null || data === undefined) {
                throw new Error(
                    `no data.${String(operation)} (${observed.errorCode ?? "no code"}: ` +
          `${observed.errorMessage ?? "no message"})`,
                )
            }
            return data as NonNullable<TData[K]>
        }

        it("invite → accept → collaborator sees and edits the task → revoke → access gone",
            async () => {
                const {
                    http, auth, dataSource 
                } = world
                const owner = await auth.persona("owner")
                const collaborator = await auth.persona("other")
                const collaboratorEmail = auth.personaEmail("other")

                const task = dataOf(
                    await http.graphql<{ createTask: { taskId: string } }>(
                        "createTask",
                        {
                            variables: {
                                input: {
                                    title: `${RUN}-shared` 
                                } 
                            }, token: owner.token 
                        },
                    ),
                    "createTask",
                )

                // Invite: pending row, addressed to the collaborator's sign-in email, editor role.
                const invitation = dataOf(
                    await http.graphql<{ invite: Invitation & { taskId: string } }>(
                        "invite",
                        {
                            variables: {
                                input: {
                                    taskId: task.taskId, email: collaboratorEmail, role: "editor" 
                                } 
                            },
                            token: owner.token,
                        },
                    ),
                    "invite",
                )
                expect(invitation).toMatchObject({
                    taskId: task.taskId,
                    email: collaboratorEmail,
                    role: "editor",
                    status: "pending",
                })

                // Not yet accepted: the invitee is still a stranger -- no collaborator rows, no completion.
                const beforeAccept = dataOf(
                    await http.graphql<{ collaborators: Array<Invitation> }>(
                        "collaborators",
                        {
                            variables: {
                                taskId: task.taskId 
                            }, token: collaborator.token 
                        },
                    ),
                    "collaborators",
                )
                expect(beforeAccept).toEqual([])
                const refusedBeforeAccept = await http.graphql(
                    "completeTask",
                    {
                        variables: {
                            id: task.taskId 
                        }, token: collaborator.token 
                    },
                )
                expect(refusedBeforeAccept.errorCode).toBe("TASK_FORBIDDEN")

                // Accept: the invitee names its own email, binding personId to the row and the role to the
                // synchronous collaborator cache in the same call.
                const accepted = dataOf(
                    await http.graphql<{ acceptInvitation: Invitation }>(
                        "acceptInvitation",
                        {
                            variables: {
                                input: {
                                    invitationId: invitation.invitationId, email: collaboratorEmail 
                                },
                            },
                            token: collaborator.token,
                        },
                    ),
                    "acceptInvitation",
                )
                expect(accepted).toMatchObject({
                    invitationId: invitation.invitationId,
                    role: "editor",
                    status: "accepted",
                })

                // Sees: a bound collaborator reads the task's invitation list.
                const seen = dataOf(
                    await http.graphql<{ collaborators: Array<Invitation> }>(
                        "collaborators",
                        {
                            variables: {
                                taskId: task.taskId 
                            }, token: collaborator.token 
                        },
                    ),
                    "collaborators",
                )
                expect(seen).toEqual([
                    expect.objectContaining({
                        invitationId: invitation.invitationId,
                        email: collaboratorEmail,
                        role: "editor",
                        status: "accepted",
                    }),
                ])

                // Edits: an accepted editor may complete the owner's task; the owner observes the result.
                const completed = dataOf(
                    await http.graphql<{ completeTask: { taskId: string; complete: boolean } }>(
                        "completeTask",
                        {
                            variables: {
                                id: task.taskId 
                            }, token: collaborator.token 
                        },
                    ),
                    "completeTask",
                )
                expect(completed).toEqual({
                    taskId: task.taskId, complete: true 
                })
                const ownerTasks = dataOf(
                    await http.graphql<{ tasks: Array<{ taskId: string; title: string; complete: boolean }> }>(
                        "listTasks",
                        {
                            token: owner.token 
                        },
                    ),
                    "tasks",
                )
                expect(ownerTasks.find(row => row.taskId === task.taskId)).toMatchObject({
                    complete: true 
                })
                // Sharing never widens ownership: the task still does not appear in the collaborator's own list.
                const collaboratorTasks = dataOf(
                    await http.graphql<{ tasks: Array<{ taskId: string }> }>(
                        "listTasks",
                        {
                            token: collaborator.token 
                        },
                    ),
                    "tasks",
                )
                expect(collaboratorTasks.map(row => row.taskId)).not.toContain(task.taskId)

                // Revoke: the owner flips the row; the cache entry is deleted in the same call.
                const revoked = dataOf(
                    await http.graphql<{ revokeCollaborator: { invitationId: string; status: string } }>(
                        "revokeCollaborator",
                        {
                            variables: {
                                input: {
                                    invitationId: invitation.invitationId 
                                } 
                            }, token: owner.token 
                        },
                    ),
                    "revokeCollaborator",
                )
                expect(revoked).toMatchObject({
                    invitationId: invitation.invitationId,
                    status: "revoked",
                })

                // Access gone, immediately: the very next transition attempt by the ex-collaborator is refused.
                const refusedAfterRevoke = await http.graphql(
                    "reopenTask",
                    {
                        variables: {
                            id: task.taskId 
                        }, token: collaborator.token 
                    },
                )
                expect(refusedAfterRevoke.errorCode).toBe("TASK_FORBIDDEN")
                expect(refusedAfterRevoke.data).toBeNull()

                // Out-of-band verify: the row persisted as revoked, personId intact (only a fresh invite for
                // the same pair clears it), revoked_at stamped.
                const rows = await dataSource.query<Array<{ status: string; person_id: string | null; revoked_at: string | null }>>(
                    "select status, person_id, revoked_at from invitations where id = $1",
                    [invitation.invitationId],
                )
                expect(rows).toHaveLength(1)
                expect(rows[0].status).toBe("revoked")
                expect(rows[0].person_id).toBe(collaborator.personId)
                expect(rows[0].revoked_at).toBeTruthy()
            })
    })

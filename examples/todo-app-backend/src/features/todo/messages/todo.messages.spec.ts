import {
    TODO_MESSAGES 
} from "./todo.messages"

describe("TODO_MESSAGES",
    () => {
        it("answers every key in English by default and in Vietnamese on request",
            () => {
                expect(TODO_MESSAGES.get("acceptInvitation.description")).toBe("Accept a pending invitation addressed to the caller.")
                expect(TODO_MESSAGES.get("acceptInvitation.description",
                    {
                    },
                    "vi")).toBe("Chấp nhận lời mời đang chờ được gửi cho người gọi.")
            })

        it("has non-empty text in both languages for every key",
            () => {
                for (const key of ["acceptInvitation.description",
                    "auditLog.description",
                    "collaborators.description",
                    "completeErasure.description",
                    "completeTask.description",
                    "createTask.description",
                    "deleteTask.description",
                    "downgradePlan.description",
                    "editRecurrence.description",
                    "editRecurrence.input.time",
                    "editRecurrence.input.timeZone",
                    "endRecurrence.description",
                    "endRecurrence.input.endedAt",
                    "endRecurrence.response.orphanedCount",
                    "exportMyData.description",
                    "health.databaseUnreachable",
                    "invite.description",
                    "listTasks.description",
                    "makeRecurring.description",
                    "makeRecurring.input.dayOfMonth",
                    "makeRecurring.input.frequency",
                    "makeRecurring.input.n",
                    "makeRecurring.input.startDate",
                    "makeRecurring.input.time",
                    "makeRecurring.input.timeZone",
                    "notificationPreferences.description",
                    "planUsage.description",
                    "planUsage.response.cap",
                    "reconcilePayment.description",
                    "reopenTask.description",
                    "requestErasure.description",
                    "revokeCollaborator.description",
                    "signIn.description",
                    "signOut.description",
                    "taskCounts.description",
                    "unsubscribe.description",
                    "upcomingOccurrences.description",
                    "upcomingOccurrences.response.previewDates",
                    "updateNotificationPreferences.description",
                    "upgradePlan.description"] as const) {
                    expect(TODO_MESSAGES.get(key,
                        {
                        },
                        "vi").trim()).not.toBe("")
                    expect(TODO_MESSAGES.get(key,
                        {
                        },
                        "en").trim()).not.toBe("")
                }
            })
    })

import {
    Injectable
} from "@nestjs/common"
import {
    E2EDbService
} from "../e2e-db.service"

/** The `NotificationRow` shape the out-of-band read returns, column names as the table spells them. */
export interface NotificationRow {
  id: string;
  digest_group_id: string | null;
}
/** The `AttemptRow` shape the out-of-band read returns, column names as the table spells them. */
export interface AttemptRow {
  state: string;
  attempt: number;
  failure_class: string | null;
  history: Array<{ state: string; at: string; failureClass?: string | null }>;
}

@Injectable()
/** Out-of-band reads over notifications and their delivery attempts. */
export class E2ENotifyRepository {
    constructor(private readonly db: E2EDbService) {}

    async taskCompleteNotifications(recipientId: string, taskId: string): Promise<Array<NotificationRow>> {
        return this.db.query<NotificationRow>(
            "select id, digest_group_id from notify_notifications where recipient_id = $1 and kind = 'task-complete' and payload->>'taskId' = $2",
            [recipientId,
                taskId],
        )
    }

    async attemptsOf(notificationId: string): Promise<Array<AttemptRow>> {
        return this.db.query<AttemptRow>(
            "select state, attempt, failure_class, history from notify_delivery_attempts where notification_id = $1",
            [notificationId],
        )
    }

    async taskCompleteWithAttempt(recipientId: string, taskId: string): Promise<Array<NotificationRow & AttemptRow>> {
        return this.db.query<NotificationRow & AttemptRow>(
            `select n.id, n.digest_group_id, a.state, a.attempt, a.failure_class, a.history
               from notify_notifications n
               join notify_delivery_attempts a on a.notification_id = n.id
               where n.recipient_id = $1 and n.kind = 'task-complete' and n.payload->>'taskId' = $2`,
            [recipientId,
                taskId],
        )
    }
}

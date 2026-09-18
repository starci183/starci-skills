import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * data.notify.preference: at most one row per (personId, channel) pair. `unsubscribed: true` suppresses
 * every future notification on that channel until it is set back to false (br.notify.unsubscribe.honored).
 * `digestWindowMinutes` overrides decision.notify.digest-window's default when set; null means "use the
 * default".
 */
@Entity({ name: 'notify_preferences' })
export class NotifyPreferenceEntity {
  @PrimaryColumn('text', { name: 'person_id' })
  personId!: string;

  @PrimaryColumn('text')
  channel!: string;

  @Column('boolean')
  unsubscribed!: boolean;

  @Column('integer', { name: 'digest_window_minutes', nullable: true })
  digestWindowMinutes!: number | null;
}

import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * data.recur.rule: owner is bound at creation and never rewritten; endedAt, once set, is never cleared.
 * `n` is set only when frequency is `every-n-days`, `dayOfMonth` only when frequency is `monthly-day`
 * (data.recur.rule's own invariant) - both are nullable columns rather than two narrower tables, matching
 * how `data.task.task`'s own nullable `completed_at` already reads in this schema.
 */
@Entity({ name: 'recurrence_rules' })
export class RuleEntity {
  @PrimaryColumn('text')
  id!: string;

  @Column('text')
  owner!: string;

  @Column('text')
  title!: string;

  @Column('text')
  frequency!: string;

  @Column('integer', { nullable: true })
  n!: number | null;

  @Column('integer', { name: 'day_of_month', nullable: true })
  dayOfMonth!: number | null;

  @Column('text', { name: 'time_zone' })
  timeZone!: string;

  @Column('text')
  time!: string;

  @Column('text', { name: 'start_date' })
  startDate!: string;

  @Column('text', { name: 'ended_at', nullable: true })
  endedAt!: string | null;
}

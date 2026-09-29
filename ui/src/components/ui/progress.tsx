import * as React from 'react';
import { ProgressBar } from '@heroui/react';
import type { Tone } from '../status';

export function Progress({ value = 0, tone, className, ...props }: Omit<React.ComponentProps<typeof ProgressBar>, 'color' | 'children'> & { tone?: Tone }) {
  return <ProgressBar data-slot="progress" data-tone={tone} value={value} color={tone === 'success' ? 'success' : tone === 'failed' ? 'danger' : tone === 'warning' ? 'warning' : 'accent'} className={['st-progress', tone && 'progress-tone', className].filter(Boolean).join(' ')} {...props}>
    <ProgressBar.Track><ProgressBar.Fill data-slot="progress-indicator" /></ProgressBar.Track>
  </ProgressBar>;
}
